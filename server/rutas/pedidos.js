import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, uno, todos, correr, transaccion, configCompleta } from '../db.js';
import { requiere } from '../auth.js';
import { DIR_UPLOADS } from '../config.js';
import { ahoraLocal, hoyLocal, limpiar, entero, telefonoNormal, horaLocal } from '../util.js';
import * as seg from '../seguimientos.js';

export const rutas = Router();
// El domiciliario entra, pero solo a lo suyo: ver, marcar en ruta/entregado y subir la foto
// de los pedidos que tiene asignados. Todo lo demás exige admin o trabajador.
rutas.use(requiere('admin', 'trabajador', 'domiciliario'), (req, res, next) => {
  if (req.usuario.rol !== 'domiciliario') return next();
  if (req.path === '/mis-entregas') return next();
  const m = req.path.match(/^\/(\d+)(\/estado|\/evidencia)?$/);
  const permitido = m && ((req.method === 'GET' && !m[2]) || (req.method === 'POST' && m[2]));
  if (!permitido) return res.status(403).json({ error: 'Esta parte no es para domiciliarios' });
  const p = uno('SELECT domiciliario_id FROM pedidos WHERE id = ?', Number(m[1]));
  if (!p || p.domiciliario_id !== req.usuario.domiciliario_id) return res.status(403).json({ error: 'Ese pedido no está asignado a usted' });
  if (m[2] === '/estado' && !['en_ruta', 'entregado'].includes(req.body?.estado)) return res.status(403).json({ error: 'Solo puede marcar en ruta o entregado' });
  next();
});

// Entregas propias del domiciliario (hoy + atrasadas + próximas).
rutas.get('/mis-entregas', (req, res) => {
  const d = req.usuario.domiciliario_id;
  if (!d) return res.status(403).json({ error: 'Solo para domiciliarios' });
  const filas = todos(`SELECT p.*, (SELECT group_concat(i.cantidad || 'x ' || i.nombre, ' · ') FROM pedido_items i WHERE i.pedido_id = p.id) AS resumen_items
      FROM pedidos p WHERE p.domiciliario_id = ? AND (p.estado IN ('confirmado','preparacion','listo','en_ruta') OR (p.estado = 'entregado' AND p.fecha_entrega >= ?))
      ORDER BY p.estado = 'entregado', p.fecha_entrega, p.urgente DESC, p.franja, p.hora_entrega, p.id`, d, hoyLocal());
  res.json(filas);
});

export const ESTADOS = ['nuevo', 'confirmado', 'preparacion', 'listo', 'en_ruta', 'entregado', 'cancelado'];
export const NOMBRE_ESTADO = {
  nuevo: 'Nuevo', confirmado: 'Confirmado', preparacion: 'En preparación', listo: 'Listo',
  en_ruta: 'En ruta', entregado: 'Entregado', cancelado: 'Cancelado',
};

const subir = multer({
  storage: multer.diskStorage({
    destination: DIR_UPLOADS,
    filename: (_req, file, cb) => cb(null, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname || '').toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/|^application\/pdf$/.test(file.mimetype)),
});

// --- helpers -----------------------------------------------------------------
function siguienteCodigo() {
  const r = uno("SELECT codigo FROM pedidos ORDER BY id DESC LIMIT 1");
  const n = r ? Number(String(r.codigo).replace(/\D/g, '')) + 1 : 1;
  return `P${String(n).padStart(4, '0')}`;
}

function historial(pedidoId, usuarioId, accion, detalle = '') {
  correr('INSERT INTO pedido_historial(pedido_id, usuario_id, accion, detalle) VALUES (?,?,?,?)', pedidoId, usuarioId, accion, detalle);
}

/** CRM automático: crea o actualiza el cliente por teléfono. */
export function upsertCliente({ telefono, nombre, email }) {
  const tel = telefonoNormal(telefono);
  if (!tel) return null;
  const c = uno('SELECT * FROM clientes WHERE telefono = ?', tel);
  if (c) {
    if ((nombre && !c.nombre) || (email && !c.email)) {
      correr('UPDATE clientes SET nombre = COALESCE(NULLIF(?, \'\'), nombre), email = COALESCE(NULLIF(?, \'\'), email) WHERE id = ?', limpiar(nombre, 80), limpiar(email, 120), c.id);
    }
    return c.id;
  }
  const r = correr('INSERT INTO clientes(telefono, nombre, email) VALUES (?,?,?)', tel, limpiar(nombre, 80) || null, limpiar(email, 120) || null);
  return Number(r.lastInsertRowid);
}

function calcularTotales(items, { domicilio_valor, recargo_pct, descuento }) {
  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const dom = entero(domicilio_valor);
  const base = subtotal + dom - entero(descuento);
  const recargo = Math.round(base * (Number(recargo_pct) || 0) / 100);
  return { subtotal, domicilio_valor: dom, descuento: entero(descuento), recargo, total: Math.max(0, base + recargo) };
}

function normalizarItems(items) {
  const salida = [];
  for (const it of Array.isArray(items) ? items : []) {
    const cantidad = Math.max(1, entero(it.cantidad, 1));
    const precio = Math.max(0, entero(it.precio));
    const nombre = limpiar(it.nombre, 120);
    if (!nombre) continue;
    let producto_id = it.producto_id ? String(it.producto_id) : null;
    if (producto_id && !uno('SELECT id FROM productos WHERE id = ?', producto_id)) producto_id = null;
    salida.push({ producto_id, nombre, cantidad, precio, nota: limpiar(it.nota, 200) || null });
  }
  return salida;
}

function recalcularPago(pedidoId) {
  const p = uno('SELECT total FROM pedidos WHERE id = ?', pedidoId);
  const pagado = uno('SELECT COALESCE(SUM(monto),0) AS s FROM pagos WHERE pedido_id = ? AND anulado = 0', pedidoId).s;
  const estado_pago = pagado <= 0 ? 'pendiente' : pagado >= p.total ? 'pagado' : 'abono';
  correr('UPDATE pedidos SET pagado = ?, estado_pago = ?, actualizado_en = ? WHERE id = ?', pagado, estado_pago, ahoraLocal(), pedidoId);
  return { pagado, estado_pago };
}

export function pedidoCompleto(id) {
  const p = uno(`SELECT p.*, u.nombre AS creado_por_nombre, pr.nombre AS preparador_nombre,
                        d.nombre AS domiciliario_nombre, d.telefono AS domiciliario_telefono
                 FROM pedidos p
                 LEFT JOIN usuarios u ON u.id = p.creado_por
                 LEFT JOIN usuarios pr ON pr.id = p.preparador_id
                 LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id
                 WHERE p.id = ?`, id);
  if (!p) return null;
  p.items = todos('SELECT i.*, pr.imagen FROM pedido_items i LEFT JOIN productos pr ON pr.id = i.producto_id WHERE pedido_id = ? ORDER BY id', id);
  p.pagos = todos('SELECT pg.*, u.nombre AS registrado_por_nombre FROM pagos pg LEFT JOIN usuarios u ON u.id = pg.registrado_por WHERE pedido_id = ? ORDER BY fecha', id);
  p.historial = todos('SELECT h.*, u.nombre AS usuario_nombre FROM pedido_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id WHERE pedido_id = ? ORDER BY id DESC', id);
  p.seguimientos = todos('SELECT id, tipo, programado_para, enviado_en, estado, error, mensaje FROM seguimientos WHERE pedido_id = ? ORDER BY id', id);
  return p;
}

/** Guarda (crea o edita) un pedido a partir del cuerpo del formulario. Devuelve el id. */
export function guardarPedido(cuerpo, usuarioId, existente = null) {
  const cfg = configCompleta();
  const items = normalizarItems(cuerpo.items);
  if (!items.length) throw new Error('El pedido necesita al menos un producto o arreglo');
  const tipo_entrega = cuerpo.tipo_entrega === 'recoge' ? 'recoge' : 'domicilio';
  let zona = null;
  if (tipo_entrega === 'domicilio' && cuerpo.zona_id) zona = uno('SELECT * FROM zonas WHERE id = ?', Number(cuerpo.zona_id));
  const domicilio_valor = tipo_entrega === 'recoge' ? 0 : (cuerpo.domicilio_valor !== undefined && cuerpo.domicilio_valor !== '' ? entero(cuerpo.domicilio_valor) : (zona?.precio ?? 0));
  const medio = (cfg.medios_pago || []).find((m) => m.clave === cuerpo.medio_pago_previsto);
  const recargo_pct = cuerpo.recargo_pct !== undefined && cuerpo.recargo_pct !== '' ? Number(cuerpo.recargo_pct) : (medio?.recargo || 0);
  const t = calcularTotales(items, { domicilio_valor, recargo_pct, descuento: cuerpo.descuento });
  const telefono = telefonoNormal(cuerpo.cliente_telefono);
  const cliente_id = upsertCliente({ telefono, nombre: cuerpo.cliente_nombre, email: cuerpo.cliente_email });
  const fecha_entrega = /^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo.fecha_entrega || '')) ? cuerpo.fecha_entrega : hoyLocal();
  const franja = (cfg.franjas || []).some((f) => f.clave === cuerpo.franja) ? cuerpo.franja : null;

  const campos = {
    canal: limpiar(cuerpo.canal, 20) || 'whatsapp',
    cliente_id, cliente_nombre: limpiar(cuerpo.cliente_nombre, 80) || null, cliente_telefono: telefono || null,
    tipo_entrega, fecha_entrega, franja, hora_entrega: limpiar(cuerpo.hora_entrega, 5) || null,
    zona_id: zona?.id ?? null, zona_nombre: zona?.zona ?? (limpiar(cuerpo.zona_nombre, 80) || null),
    direccion: limpiar(cuerpo.direccion, 200) || null, punto_referencia: limpiar(cuerpo.punto_referencia, 200) || null,
    recibe_nombre: limpiar(cuerpo.recibe_nombre, 80) || null, recibe_telefono: telefonoNormal(cuerpo.recibe_telefono) || null,
    tarjeta_para: limpiar(cuerpo.tarjeta_para, 80) || null, tarjeta_mensaje: limpiar(cuerpo.tarjeta_mensaje, 600) || null, tarjeta_de: limpiar(cuerpo.tarjeta_de, 80) || null,
    ocasion: limpiar(cuerpo.ocasion, 30) || null,
    funeraria: limpiar(cuerpo.funeraria, 120) || null, sala: limpiar(cuerpo.sala, 40) || null, fallecido: limpiar(cuerpo.fallecido, 120) || null,
    especificaciones: limpiar(cuerpo.especificaciones, 800) || null, notas_internas: limpiar(cuerpo.notas_internas, 800) || null,
    subtotal: t.subtotal, domicilio_valor: t.domicilio_valor, recargo: t.recargo, descuento: t.descuento, total: t.total,
    urgente: cuerpo.urgente ? 1 : 0,
    actualizado_en: ahoraLocal(),
  };

  return transaccion(() => {
    let id;
    if (existente) {
      id = existente.id;
      const sets = Object.keys(campos).map((k) => `${k} = ?`).join(', ');
      correr(`UPDATE pedidos SET ${sets} WHERE id = ?`, ...Object.values(campos), id);
      correr('DELETE FROM pedido_items WHERE pedido_id = ?', id);
      historial(id, usuarioId, 'editado', 'Datos del pedido actualizados');
    } else {
      const codigo = siguienteCodigo();
      const extra = { codigo, creado_por: usuarioId, origen: cuerpo.origen === 'bot' ? 'bot' : 'pos', bot_conv_id: limpiar(cuerpo.bot_conv_id, 40) || null, bot_pedido_id: limpiar(cuerpo.bot_pedido_id, 40) || null, estado: cuerpo.estado_inicial === 'confirmado' ? 'confirmado' : 'nuevo' };
      const todo = { ...campos, ...extra };
      const cols = Object.keys(todo);
      const r = correr(`INSERT INTO pedidos(${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...Object.values(todo));
      id = Number(r.lastInsertRowid);
      historial(id, usuarioId, 'creado', extra.origen === 'bot' ? 'Creado por el agente de WhatsApp' : 'Creado en el sistema');
    }
    for (const it of items) {
      correr('INSERT INTO pedido_items(pedido_id, producto_id, nombre, cantidad, precio, nota) VALUES (?,?,?,?,?,?)', id, it.producto_id, it.nombre, it.cantidad, it.precio, it.nota);
    }
    recalcularPago(id);
    const p = uno('SELECT * FROM pedidos WHERE id = ?', id);
    seg.registrarFechaImportante(p);
    return id;
  });
}

// --- listado -----------------------------------------------------------------
rutas.get('/', (req, res) => {
  const { fecha, desde, hasta, estado, q, cliente_id, domiciliario_id, pago, limite } = req.query;
  const cond = []; const par = [];
  if (fecha) { cond.push('p.fecha_entrega = ?'); par.push(String(fecha)); }
  if (desde) { cond.push('p.fecha_entrega >= ?'); par.push(String(desde)); }
  if (hasta) { cond.push('p.fecha_entrega <= ?'); par.push(String(hasta)); }
  if (estado) {
    const lista = String(estado).split(',').filter((e) => ESTADOS.includes(e));
    if (lista.length) { cond.push(`p.estado IN (${lista.map(() => '?').join(',')})`); par.push(...lista); }
  }
  if (pago) { cond.push('p.estado_pago = ?'); par.push(String(pago)); }
  if (cliente_id) { cond.push('p.cliente_id = ?'); par.push(Number(cliente_id)); }
  if (domiciliario_id) { cond.push('p.domiciliario_id = ?'); par.push(Number(domiciliario_id)); }
  if (q) {
    const like = `%${String(q).trim()}%`;
    cond.push('(p.codigo LIKE ? OR p.cliente_nombre LIKE ? OR p.cliente_telefono LIKE ? OR p.recibe_nombre LIKE ? OR p.direccion LIKE ? OR EXISTS (SELECT 1 FROM pedido_items i WHERE i.pedido_id = p.id AND i.nombre LIKE ?))');
    par.push(like, like, like, like, like, like);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const lim = Math.min(500, Math.max(1, entero(limite, 200)));
  const filas = todos(`SELECT p.*, d.nombre AS domiciliario_nombre, pr.nombre AS preparador_nombre,
      (SELECT group_concat(i.cantidad || 'x ' || i.nombre, ' · ') FROM pedido_items i WHERE i.pedido_id = p.id) AS resumen_items
      FROM pedidos p LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id LEFT JOIN usuarios pr ON pr.id = p.preparador_id
      ${where} ORDER BY p.fecha_entrega DESC, p.urgente DESC, p.id DESC LIMIT ${lim}`, ...par);
  res.json(filas);
});

rutas.get('/:id', (req, res) => {
  const p = pedidoCompleto(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'No existe' });
  res.json(p);
});

rutas.post('/', (req, res) => {
  try {
    const id = guardarPedido(req.body || {}, req.usuario.id);
    const p = pedidoCompleto(id);
    if (p.estado === 'confirmado') seg.alConfirmar(p);
    res.json(pedidoCompleto(id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

rutas.put('/:id', (req, res) => {
  const existente = uno('SELECT * FROM pedidos WHERE id = ?', Number(req.params.id));
  if (!existente) return res.status(404).json({ error: 'No existe' });
  if (existente.estado === 'entregado' && req.usuario.rol !== 'admin') return res.status(403).json({ error: 'Un pedido entregado solo lo edita el administrador' });
  try {
    guardarPedido(req.body || {}, req.usuario.id, existente);
    res.json(pedidoCompleto(existente.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// --- estado ------------------------------------------------------------------
rutas.post('/:id/estado', (req, res) => {
  const p = uno('SELECT * FROM pedidos WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'No existe' });
  const { estado, motivo } = req.body || {};
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  if (p.estado === 'cancelado' && req.usuario.rol !== 'admin') return res.status(403).json({ error: 'Solo el administrador reabre un pedido cancelado' });
  const ahora = ahoraLocal(); const hora = horaLocal();
  const sets = ['estado = ?', 'actualizado_en = ?']; const par = [estado, ahora];
  if (estado === 'preparacion' && !p.preparador_id) { sets.push('preparador_id = ?'); par.push(req.usuario.id); }
  if (estado === 'listo') { sets.push('hora_lista = ?'); par.push(hora); }
  if (estado === 'en_ruta') { sets.push('hora_salida = ?'); par.push(hora); }
  if (estado === 'entregado') { sets.push('hora_entregado = ?'); par.push(hora); }
  if (estado === 'cancelado') { sets.push('cancelado_motivo = ?'); par.push(limpiar(motivo, 200) || null); }
  correr(`UPDATE pedidos SET ${sets.join(', ')} WHERE id = ?`, ...par, p.id);
  historial(p.id, req.usuario.id, 'estado', `${NOMBRE_ESTADO[p.estado]} → ${NOMBRE_ESTADO[estado]}${motivo ? ` (${motivo})` : ''}`);
  const nuevo = pedidoCompleto(p.id);
  if (estado === 'confirmado' && p.estado === 'nuevo') seg.alConfirmar(nuevo);
  if (estado === 'entregado') seg.alEntregar(nuevo);
  if (estado === 'cancelado') seg.alCancelar(nuevo);
  res.json(pedidoCompleto(p.id));
});

// --- asignaciones ------------------------------------------------------------
rutas.post('/:id/asignar', (req, res) => {
  const p = uno('SELECT * FROM pedidos WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'No existe' });
  const { preparador_id, domiciliario_id, hora_entrega, franja } = req.body || {};
  const sets = ['actualizado_en = ?']; const par = [ahoraLocal()]; const notas = [];
  if (preparador_id !== undefined) {
    const u = preparador_id ? uno('SELECT nombre FROM usuarios WHERE id = ?', Number(preparador_id)) : null;
    sets.push('preparador_id = ?'); par.push(u ? Number(preparador_id) : null); notas.push(`prepara: ${u?.nombre || 'nadie'}`);
  }
  if (domiciliario_id !== undefined) {
    const d = domiciliario_id ? uno('SELECT nombre FROM domiciliarios WHERE id = ?', Number(domiciliario_id)) : null;
    sets.push('domiciliario_id = ?'); par.push(d ? Number(domiciliario_id) : null); notas.push(`domiciliario: ${d?.nombre || 'nadie'}`);
  }
  if (hora_entrega !== undefined) { sets.push('hora_entrega = ?'); par.push(limpiar(hora_entrega, 5) || null); notas.push(`hora: ${hora_entrega || '—'}`); }
  if (franja !== undefined) { sets.push('franja = ?'); par.push(limpiar(franja, 20) || null); notas.push(`franja: ${franja || '—'}`); }
  correr(`UPDATE pedidos SET ${sets.join(', ')} WHERE id = ?`, ...par, p.id);
  historial(p.id, req.usuario.id, 'asignacion', notas.join(' · '));
  res.json(pedidoCompleto(p.id));
});

rutas.post('/:id/notas', (req, res) => {
  const p = uno('SELECT id FROM pedidos WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'No existe' });
  correr('UPDATE pedidos SET notas_internas = ?, actualizado_en = ? WHERE id = ?', limpiar(req.body?.notas_internas, 800) || null, ahoraLocal(), p.id);
  historial(p.id, req.usuario.id, 'nota', limpiar(req.body?.notas_internas, 120));
  res.json(pedidoCompleto(p.id));
});

// --- pagos -------------------------------------------------------------------
rutas.post('/:id/pagos', subir.single('comprobante'), (req, res) => {
  const p = uno('SELECT * FROM pedidos WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'No existe' });
  const cfg = configCompleta();
  const medio = limpiar(req.body?.medio, 30);
  if (!(cfg.medios_pago || []).some((m) => m.clave === medio)) return res.status(400).json({ error: 'Medio de pago inválido' });
  const monto = entero(req.body?.monto);
  if (monto <= 0) return res.status(400).json({ error: 'El monto debe ser mayor que cero' });
  const fecha = req.body?.fecha && /^\d{4}-\d{2}-\d{2}/.test(req.body.fecha) ? `${req.body.fecha.slice(0, 10)} ${horaLocal()}:00` : ahoraLocal();
  correr('INSERT INTO pagos(pedido_id, fecha, medio, monto, comprobante, nota, registrado_por) VALUES (?,?,?,?,?,?,?)',
    p.id, fecha, medio, monto, req.file ? req.file.filename : null, limpiar(req.body?.nota, 200) || null, req.usuario.id);
  const r = recalcularPago(p.id);
  historial(p.id, req.usuario.id, 'pago', `${medio} $${monto.toLocaleString('es-CO')} → ${r.estado_pago}`);
  seg.alPagar(pedidoCompleto(p.id));
  res.json(pedidoCompleto(p.id));
});

rutas.delete('/:id/pagos/:pagoId', requiere('admin'), (req, res) => {
  const pg = uno('SELECT * FROM pagos WHERE id = ? AND pedido_id = ?', Number(req.params.pagoId), Number(req.params.id));
  if (!pg) return res.status(404).json({ error: 'No existe' });
  correr('UPDATE pagos SET anulado = 1 WHERE id = ?', pg.id);
  recalcularPago(pg.pedido_id);
  historial(pg.pedido_id, req.usuario.id, 'pago_anulado', `${pg.medio} $${pg.monto.toLocaleString('es-CO')}`);
  const nuevo = pedidoCompleto(pg.pedido_id);
  seg.programarPagoPendiente(nuevo);
  res.json(nuevo);
});

// --- evidencia de entrega ----------------------------------------------------
rutas.post('/:id/evidencia', subir.single('foto'), (req, res) => {
  const p = uno('SELECT * FROM pedidos WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'No existe' });
  if (!req.file) return res.status(400).json({ error: 'Falta la foto' });
  const marcarEntregado = req.body?.entregar === '1' || req.body?.entregar === 'true';
  const sets = ['evidencia_foto = ?', 'actualizado_en = ?']; const par = [req.file.filename, ahoraLocal()];
  if (marcarEntregado && p.estado !== 'entregado') { sets.push('estado = ?', 'hora_entregado = ?'); par.push('entregado', horaLocal()); }
  correr(`UPDATE pedidos SET ${sets.join(', ')} WHERE id = ?`, ...par, p.id);
  historial(p.id, req.usuario.id, 'evidencia', marcarEntregado ? 'Foto de entrega · marcado como entregado' : 'Foto de entrega');
  if (marcarEntregado && p.estado !== 'entregado') seg.alEntregar(pedidoCompleto(p.id));
  res.json(pedidoCompleto(p.id));
});

// --- seguimientos del pedido ---------------------------------------------------
rutas.post('/:id/seguimientos/:segId/reintentar', (req, res) => {
  correr("UPDATE seguimientos SET estado = 'pendiente', error = NULL, programado_para = ? WHERE id = ? AND pedido_id = ?", ahoraLocal(), Number(req.params.segId), Number(req.params.id));
  res.json(pedidoCompleto(Number(req.params.id)));
});
rutas.post('/:id/seguimientos/:segId/cancelar', (req, res) => {
  correr("UPDATE seguimientos SET estado = 'cancelado' WHERE id = ? AND pedido_id = ? AND estado = 'pendiente'", Number(req.params.segId), Number(req.params.id));
  res.json(pedidoCompleto(Number(req.params.id)));
});
