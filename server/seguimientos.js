// Seguimientos automáticos por WhatsApp: mensaje al confirmar y al entregar,
// alerta de pago pendiente y recordatorio de recompra en fechas especiales.
// Todo se ENCOLA en la tabla `seguimientos`; un reloj los envía por Evolution
// cuando llega su hora. Con `seguimientos.activo = false` se encolan igual
// (para verlos en el panel) pero se marcan como cancelados al vencer, así Tati
// puede revisar los textos antes de que salga el primero.
import { todos, uno, correr, configCompleta } from './db.js';
import { ahoraLocal, hoyLocal, pesos, fechaBonita, sumarDias } from './util.js';
import { enviarTexto } from './whatsapp.js';

function rellenar(plantilla, datos) {
  return String(plantilla || '').replace(/\{(\w+)\}/g, (_, k) => (datos[k] ?? ''));
}

function datosPedido(p, cfg) {
  const franja = (cfg.franjas || []).find((f) => f.clave === p.franja);
  return {
    nombre: (p.cliente_nombre || '').split(' ')[0] || 'cliente',
    codigo: p.codigo,
    fecha: fechaBonita(p.fecha_entrega),
    franja: franja ? `${franja.nombre} ${franja.desde}–${franja.hasta}` : (p.hora_entrega || ''),
    total: pesos(p.total),
    pendiente: pesos(Math.max(0, p.total - p.pagado)),
    recibe: p.recibe_nombre || '',
  };
}

function encolar({ pedido, tipo, telefono, mensaje, cuando, cliente_id }) {
  if (!telefono || !mensaje) return null;
  // no duplicar el mismo tipo pendiente para el mismo pedido
  if (pedido) {
    const ya = uno('SELECT id FROM seguimientos WHERE pedido_id = ? AND tipo = ? AND estado = ?', pedido.id, tipo, 'pendiente');
    if (ya) return ya.id;
  }
  const r = correr('INSERT INTO seguimientos(pedido_id, cliente_id, tipo, telefono, mensaje, programado_para) VALUES (?,?,?,?,?,?)',
    pedido?.id ?? null, cliente_id ?? pedido?.cliente_id ?? null, tipo, telefono, mensaje, cuando);
  return Number(r.lastInsertRowid);
}

export function cancelarPendientes(pedidoId, tipo) {
  if (tipo) correr("UPDATE seguimientos SET estado = 'cancelado' WHERE pedido_id = ? AND tipo = ? AND estado = 'pendiente'", pedidoId, tipo);
  else correr("UPDATE seguimientos SET estado = 'cancelado' WHERE pedido_id = ? AND estado = 'pendiente'", pedidoId);
}

/** Al confirmar un pedido: mensaje inmediato + alerta de pago pendiente si aplica. */
export function alConfirmar(p) {
  const cfg = configCompleta();
  const s = cfg.seguimientos;
  const d = datosPedido(p, cfg);
  if (s.confirmacion) {
    encolar({ pedido: p, tipo: 'confirmacion', telefono: p.cliente_telefono, mensaje: rellenar(s.plantillas.confirmacion, d), cuando: ahoraLocal() });
  }
  programarPagoPendiente(p);
}

export function programarPagoPendiente(p) {
  const cfg = configCompleta();
  const s = cfg.seguimientos;
  if (!s.pago_pendiente || p.estado_pago === 'pagado' || p.estado === 'cancelado') return;
  const d = datosPedido(p, cfg);
  const cuando = new Date(Date.now() + (Number(s.pago_pendiente_horas) || 2) * 3600e3);
  encolar({ pedido: p, tipo: 'pago_pendiente', telefono: p.cliente_telefono, mensaje: rellenar(s.plantillas.pago_pendiente, d), cuando: ahoraLocal(cuando) });
}

export function alPagar(p) {
  if (p.estado_pago === 'pagado') cancelarPendientes(p.id, 'pago_pendiente');
}

export function alEntregar(p) {
  const cfg = configCompleta();
  const s = cfg.seguimientos;
  cancelarPendientes(p.id, 'pago_pendiente');
  const d = datosPedido(p, cfg);
  if (s.entrega) {
    encolar({ pedido: p, tipo: 'entrega', telefono: p.cliente_telefono, mensaje: rellenar(s.plantillas.entrega, d), cuando: ahoraLocal() });
  }
}

export function alCancelar(p) { cancelarPendientes(p.id); }

/** Registra la fecha importante del cliente (ocasión + fecha de entrega) para recordar el año siguiente. */
export function registrarFechaImportante(p) {
  if (!p.cliente_id || !p.ocasion || !p.fecha_entrega) return;
  const cfg = configCompleta();
  const oc = (cfg.ocasiones || []).find((o) => o.clave === p.ocasion);
  if (!oc || !oc.recordar) return;
  const diaMes = String(p.fecha_entrega).slice(5, 10);
  const desc = [oc.nombre, p.tarjeta_para ? `para ${p.tarjeta_para}` : ''].filter(Boolean).join(' ');
  correr(`INSERT INTO fechas_importantes(cliente_id, tipo, dia_mes, descripcion, pedido_id) VALUES (?,?,?,?,?)
          ON CONFLICT(cliente_id, tipo, dia_mes) DO UPDATE SET descripcion = excluded.descripcion, pedido_id = excluded.pedido_id`,
    p.cliente_id, p.ocasion, diaMes, desc, p.id);
}

/** Corre una vez al día: encola recordatorios de recompra X días antes de cada fecha importante. */
export function programarRecompras() {
  const cfg = configCompleta();
  const s = cfg.seguimientos;
  if (!s.recompra) return 0;
  const dias = Number(s.recompra_dias_antes) || 5;
  const objetivo = sumarDias(hoyLocal(), dias).slice(5, 10); // MM-DD dentro de X días
  const filas = todos(`SELECT f.*, c.telefono, c.nombre AS cliente_nombre
                       FROM fechas_importantes f JOIN clientes c ON c.id = f.cliente_id
                       WHERE f.dia_mes = ? AND c.telefono IS NOT NULL`, objetivo);
  let n = 0;
  const anio = hoyLocal().slice(0, 4);
  for (const f of filas) {
    const ya = uno(`SELECT id FROM seguimientos WHERE cliente_id = ? AND tipo = 'recompra' AND substr(creado_en,1,4) = ? AND mensaje LIKE ?`,
      f.cliente_id, anio, `%${f.descripcion || ''}%`);
    if (ya) continue;
    const oc = (cfg.ocasiones || []).find((o) => o.clave === f.tipo);
    const mensaje = rellenar(s.plantillas.recompra, {
      nombre: (f.cliente_nombre || '').split(' ')[0] || 'cliente',
      ocasion: f.descripcion || oc?.nombre || f.tipo,
      fecha: fechaBonita(`${anio}-${f.dia_mes}`),
    });
    encolar({ tipo: 'recompra', telefono: f.telefono, mensaje, cuando: `${hoyLocal()} 09:00:00`, cliente_id: f.cliente_id });
    n++;
  }
  return n;
}

/** Envía lo vencido. Se llama cada minuto. */
export async function procesarCola() {
  const cfg = configCompleta();
  const activo = Boolean(cfg.seguimientos.activo);
  const vencidos = todos("SELECT * FROM seguimientos WHERE estado = 'pendiente' AND programado_para <= ? ORDER BY programado_para LIMIT 20", ahoraLocal());
  for (const s of vencidos) {
    if (!activo) {
      correr("UPDATE seguimientos SET estado = 'cancelado', error = 'seguimientos desactivados' WHERE id = ?", s.id);
      continue;
    }
    // Un pedido cancelado no recibe nada
    if (s.pedido_id) {
      const p = uno('SELECT estado, estado_pago FROM pedidos WHERE id = ?', s.pedido_id);
      if (!p || p.estado === 'cancelado' || (s.tipo === 'pago_pendiente' && p.estado_pago === 'pagado')) {
        correr("UPDATE seguimientos SET estado = 'cancelado' WHERE id = ?", s.id);
        continue;
      }
    }
    try {
      await enviarTexto(s.telefono, s.mensaje);
      correr("UPDATE seguimientos SET estado = 'enviado', enviado_en = ?, error = NULL WHERE id = ?", ahoraLocal(), s.id);
    } catch (e) {
      correr("UPDATE seguimientos SET estado = 'fallido', error = ? WHERE id = ?", String(e.message).slice(0, 300), s.id);
    }
  }
}
