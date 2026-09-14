// Configuración, seguimientos, WhatsApp, respaldo e integración con el agente.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, todos, uno, correr, configCompleta, guardarConfig, leerConfig, CONFIG_DEFECTO } from '../db.js';
import { requiere } from '../auth.js';
import { DATA_DIR } from '../config.js';
import { ahoraLocal, hoyLocal, limpiar, entero, telefonoNormal } from '../util.js';
import { estadoInstancia, enviarTexto } from '../whatsapp.js';
import { procesarCola, programarRecompras } from '../seguimientos.js';
import { guardarPedido, pedidoCompleto, upsertCliente } from './pedidos.js';

export const rutas = Router();

// --- configuración -----------------------------------------------------------------
rutas.get('/config', requiere(), (req, res) => {
  const cfg = configCompleta();
  if (req.usuario.rol !== 'admin') {
    // el trabajador solo necesita lo operativo, nunca llaves
    const { whatsapp, integracion_bot, ...resto } = cfg;
    return res.json(resto);
  }
  res.json(cfg);
});
rutas.put('/config/:clave', requiere('admin'), (req, res) => {
  const clave = req.params.clave;
  if (!Object.hasOwn(CONFIG_DEFECTO, clave)) return res.status(400).json({ error: 'Sección desconocida' });
  let valor = req.body?.valor;
  if (Array.isArray(CONFIG_DEFECTO[clave])) {
    if (!Array.isArray(valor)) return res.status(400).json({ error: 'Se esperaba una lista' });
    valor = valor.filter((x) => x && typeof x === 'object' && limpiar(x.clave, 30)).map((x) => ({ ...x, clave: limpiar(x.clave, 30), nombre: limpiar(x.nombre, 60) }));
    if (clave === 'franjas') valor = valor.map((f) => ({ ...f, capacidad: entero(f.capacidad, 0) }));
    if (clave === 'medios_pago') valor = valor.map((m) => ({ ...m, recargo: Number(m.recargo) || 0 }));
  } else {
    if (!valor || typeof valor !== 'object') return res.status(400).json({ error: 'Se esperaba un objeto' });
    valor = { ...(leerConfig(clave) || CONFIG_DEFECTO[clave]), ...valor };
  }
  guardarConfig(clave, valor);
  res.json({ ok: true, valor });
});

// --- WhatsApp y seguimientos ---------------------------------------------------------
rutas.get('/whatsapp/estado', requiere('admin'), async (_req, res) => res.json(await estadoInstancia()));
rutas.post('/whatsapp/prueba', requiere('admin'), async (req, res) => {
  try { await enviarTexto(req.body?.telefono, req.body?.texto || 'Prueba desde TatiPOS 🌸'); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
rutas.get('/seguimientos', requiere(), (req, res) => {
  const estado = limpiar(req.query.estado, 20);
  res.json(todos(`SELECT s.*, p.codigo, p.cliente_nombre FROM seguimientos s LEFT JOIN pedidos p ON p.id = s.pedido_id ${estado ? 'WHERE s.estado = ?' : ''} ORDER BY s.programado_para DESC LIMIT 200`, ...(estado ? [estado] : [])));
});
rutas.post('/seguimientos/:id/reintentar', requiere(), (req, res) => {
  correr("UPDATE seguimientos SET estado = 'pendiente', error = NULL, programado_para = ? WHERE id = ?", ahoraLocal(), Number(req.params.id));
  res.json({ ok: true });
});
rutas.post('/seguimientos/:id/cancelar', requiere(), (req, res) => {
  correr("UPDATE seguimientos SET estado = 'cancelado' WHERE id = ? AND estado = 'pendiente'", Number(req.params.id));
  res.json({ ok: true });
});
rutas.post('/seguimientos/procesar', requiere('admin'), async (_req, res) => {
  const n = programarRecompras(); await procesarCola(); res.json({ ok: true, recompras_programadas: n });
});
rutas.post('/seguimientos/manual', requiere(), async (req, res) => {
  // mensaje libre a un cliente (desde el detalle del pedido). Sale ya, no espera al reloj.
  const p = req.body?.pedido_id ? uno('SELECT * FROM pedidos WHERE id = ?', Number(req.body.pedido_id)) : null;
  const telefono = telefonoNormal(req.body?.telefono || p?.cliente_telefono);
  const mensaje = limpiar(req.body?.mensaje, 1500);
  if (!telefono || !mensaje) return res.status(400).json({ error: 'Faltan teléfono o mensaje' });
  const r = correr('INSERT INTO seguimientos(pedido_id, cliente_id, tipo, telefono, mensaje, programado_para) VALUES (?,?,?,?,?,?)', p?.id ?? null, p?.cliente_id ?? null, 'manual', telefono, mensaje, ahoraLocal());
  try {
    await enviarTexto(telefono, mensaje);
    correr("UPDATE seguimientos SET estado = 'enviado', enviado_en = ? WHERE id = ?", ahoraLocal(), Number(r.lastInsertRowid));
    res.json({ ok: true });
  } catch (e) {
    correr("UPDATE seguimientos SET estado = 'fallido', error = ? WHERE id = ?", String(e.message).slice(0, 300), Number(r.lastInsertRowid));
    res.status(400).json({ error: e.message });
  }
});

// --- respaldo -----------------------------------------------------------------------
rutas.post('/respaldo', requiere('admin'), (_req, res) => {
  const dir = path.join(DATA_DIR, 'respaldos'); fs.mkdirSync(dir, { recursive: true });
  const destino = path.join(dir, `tatipos-${ahoraLocal().replace(/[: ]/g, '-')}.db`);
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  const lista = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse();
  for (const viejo of lista.slice(30)) fs.unlinkSync(path.join(dir, viejo));
  res.json({ ok: true, archivo: path.basename(destino), respaldos: lista.slice(0, 30) });
});
rutas.get('/respaldo', requiere('admin'), (_req, res) => {
  const dir = path.join(DATA_DIR, 'respaldos');
  const lista = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse() : [];
  res.json(lista.map((f) => ({ archivo: f, bytes: fs.statSync(path.join(dir, f)).size })));
});

// --- integración con el agente de WhatsApp (Chatsuite) ---------------------------------
// El bot manda el pedido cuando el cliente confirma. Llave en Configuración → Integración.
rutas.post('/integraciones/bot/pedido', (req, res) => {
  const cfg = leerConfig('integracion_bot') || {};
  const llave = req.headers['x-api-key'];
  if (!cfg.apikey || !llave || String(llave) !== cfg.apikey) return res.status(401).json({ error: 'llave inválida' });
  const b = req.body || {};
  // idempotente: el mismo pedido del bot no se crea dos veces
  if (b.bot_pedido_id) {
    const ya = uno('SELECT id, codigo FROM pedidos WHERE bot_pedido_id = ?', String(b.bot_pedido_id));
    if (ya) return res.json({ ok: true, id: ya.id, codigo: ya.codigo, repetido: true });
  }
  // El bot manda un texto libre (detalle) y a veces un total. Se intenta casar con el catálogo por nombre.
  let items = Array.isArray(b.items) && b.items.length ? b.items : [];
  if (!items.length) {
    const detalle = limpiar(b.detalle, 300) || 'Pedido por WhatsApp';
    const prod = uno('SELECT * FROM productos WHERE activo = 1 AND upper(?) LIKE \'%\' || upper(nombre) || \'%\' ORDER BY length(nombre) DESC LIMIT 1', detalle);
    const zona = b.zona ? uno('SELECT * FROM zonas WHERE activo = 1 AND lower(zona) = lower(?)', String(b.zona)) : null;
    const total = entero(b.total);
    const dom = zona?.precio || 0;
    // Si el bot trae el total acordado con el cliente, ese manda (incluye adicionales
    // que el catálogo no conoce); el producto queda referenciado para el historial.
    const precio = total > 0 ? Math.max(0, total - dom) : (prod ? prod.precio : 0);
    items = [{ producto_id: prod?.id || null, nombre: prod ? prod.nombre : detalle, cantidad: 1, precio, nota: prod && detalle !== prod.nombre ? detalle : null }];
    b.zona_id = zona?.id; b.zona_nombre = b.zona;
    b.domicilio_valor = dom;
  }
  const medio = String(b.medio_pago || '').toLowerCase();
  const medioClave = (configCompleta().medios_pago || []).find((m) => medio.includes(m.clave) || medio.includes(m.nombre.toLowerCase().split(' ')[0]))?.clave;
  try {
    const fecha = /^\d{4}-\d{2}-\d{2}/.test(String(b.fecha_entrega || '')) ? String(b.fecha_entrega).slice(0, 10) : hoyLocal();
    const id = guardarPedido({
      origen: 'bot', canal: 'whatsapp', estado_inicial: 'nuevo', items,
      cliente_telefono: b.telefono, cliente_nombre: b.nombre_cliente || b.nombre || b.firma || '', cliente_email: b.email_cliente,
      tipo_entrega: /recog/i.test(String(b.detalle || '') + String(b.direccion || '')) && !b.direccion ? 'recoge' : 'domicilio',
      fecha_entrega: fecha, zona_id: b.zona_id, zona_nombre: b.zona_nombre, domicilio_valor: b.domicilio_valor,
      direccion: b.direccion, punto_referencia: b.punto_referencia, recibe_nombre: b.nombre, recibe_telefono: b.telefono_recibe,
      tarjeta_para: b.para, tarjeta_mensaje: b.mensaje_tarjeta, tarjeta_de: b.firma, ocasion: b.ocasion,
      funeraria: b.funeraria, sala: b.sala, fallecido: b.fallecido, especificaciones: [b.especificaciones, b.modelo_url].filter(Boolean).join(' · '),
      notas_internas: `Creado por el agente de WhatsApp${b.medio_pago ? ` · paga con ${b.medio_pago}` : ''}${b.telefono_envia ? ` · tel. envía ${b.telefono_envia}` : ''}`,
      medio_pago_previsto: medioClave, bot_conv_id: b.conv_id, bot_pedido_id: b.bot_pedido_id,
    }, null);
    const p = pedidoCompleto(id);
    res.json({ ok: true, id: p.id, codigo: p.codigo, total: p.total });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
rutas.post('/integraciones/bot/regenerar-llave', requiere('admin'), (_req, res) => {
  const apikey = crypto.randomBytes(24).toString('hex');
  guardarConfig('integracion_bot', { apikey });
  res.json({ ok: true, apikey });
});
