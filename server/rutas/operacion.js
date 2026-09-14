// Dashboard, agenda por franja, tablero de producción y entregas del día.
import { Router } from 'express';
import { todos, uno, configCompleta } from '../db.js';
import { requiere } from '../auth.js';
import { hoyLocal, sumarDias } from '../util.js';

export const rutas = Router();
rutas.use(requiere());

const RESUMEN = `(SELECT group_concat(i.cantidad || 'x ' || i.nombre, ' · ') FROM pedido_items i WHERE i.pedido_id = p.id) AS resumen_items`;

rutas.get('/dashboard', (req, res) => {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || '')) ? String(req.query.fecha) : hoyLocal();
  const porEstado = {};
  for (const r of todos('SELECT estado, COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM pedidos WHERE fecha_entrega = ? GROUP BY estado', fecha)) porEstado[r.estado] = r;
  const ventasDia = uno(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total, COALESCE(SUM(pagado),0) AS pagado FROM pedidos WHERE fecha_entrega = ? AND estado <> 'cancelado'`, fecha);
  const cobradoHoy = todos(`SELECT medio, COALESCE(SUM(monto),0) AS total FROM pagos WHERE substr(fecha,1,10) = ? AND anulado = 0 GROUP BY medio`, fecha);
  const pendientesPago = todos(`SELECT p.id, p.codigo, p.cliente_nombre, p.cliente_telefono, p.total, p.pagado, p.fecha_entrega, p.franja, ${RESUMEN} FROM pedidos p WHERE estado_pago <> 'pagado' AND estado NOT IN ('cancelado','entregado') AND fecha_entrega <= ? ORDER BY fecha_entrega, franja LIMIT 30`, sumarDias(fecha, 1));
  const nuevosSinConfirmar = todos(`SELECT p.id, p.codigo, p.cliente_nombre, p.total, p.fecha_entrega, p.origen, p.creado_en, ${RESUMEN} FROM pedidos p WHERE estado = 'nuevo' ORDER BY creado_en DESC LIMIT 30`);
  const proximos = todos(`SELECT fecha_entrega, COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM pedidos WHERE fecha_entrega > ? AND fecha_entrega <= ? AND estado <> 'cancelado' GROUP BY fecha_entrega ORDER BY fecha_entrega`, fecha, sumarDias(fecha, 7));
  const enRuta = todos(`SELECT p.id, p.codigo, p.recibe_nombre, p.zona_nombre, p.hora_salida, d.nombre AS domiciliario_nombre FROM pedidos p LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id WHERE p.estado = 'en_ruta' ORDER BY p.hora_salida`);
  const semana = uno(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM pedidos WHERE fecha_entrega >= ? AND fecha_entrega <= ? AND estado <> 'cancelado'`, sumarDias(fecha, -6), fecha);
  const mes = uno(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM pedidos WHERE substr(fecha_entrega,1,7) = ? AND estado <> 'cancelado'`, fecha.slice(0, 7));
  const fechasProximas = todos(`SELECT f.*, c.nombre AS cliente_nombre, c.telefono FROM fechas_importantes f JOIN clientes c ON c.id = f.cliente_id
      WHERE f.dia_mes >= ? AND f.dia_mes <= ? ORDER BY f.dia_mes LIMIT 20`, fecha.slice(5), sumarDias(fecha, 10).slice(5));
  res.json({ fecha, porEstado, ventasDia, cobradoHoy, pendientesPago, nuevosSinConfirmar, proximos, enRuta, semana, mes, fechasProximas });
});

rutas.get('/agenda', (req, res) => {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || '')) ? String(req.query.fecha) : hoyLocal();
  const cfg = configCompleta();
  const pedidos = todos(`SELECT p.*, d.nombre AS domiciliario_nombre, pr.nombre AS preparador_nombre, ${RESUMEN}
      FROM pedidos p LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id LEFT JOIN usuarios pr ON pr.id = p.preparador_id
      WHERE p.fecha_entrega = ? AND p.estado <> 'cancelado' ORDER BY p.urgente DESC, p.hora_entrega, p.id`, fecha);
  const franjas = (cfg.franjas || []).map((f) => ({ ...f, pedidos: pedidos.filter((p) => p.franja === f.clave) }));
  const sinFranja = pedidos.filter((p) => !p.franja || !franjas.some((f) => f.clave === p.franja));
  const recogen = pedidos.filter((p) => p.tipo_entrega === 'recoge');
  res.json({ fecha, franjas, sinFranja, recogen, total: pedidos.length });
});

rutas.get('/produccion', (req, res) => {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || '')) ? String(req.query.fecha) : hoyLocal();
  const cols = ['confirmado', 'preparacion', 'listo', 'en_ruta'];
  const pedidos = todos(`SELECT p.*, d.nombre AS domiciliario_nombre, pr.nombre AS preparador_nombre, ${RESUMEN}
      FROM pedidos p LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id LEFT JOIN usuarios pr ON pr.id = p.preparador_id
      WHERE (p.fecha_entrega = ? OR (p.fecha_entrega < ? AND p.estado IN ('confirmado','preparacion','listo','en_ruta'))) AND p.estado IN (${cols.map(() => '?').join(',')})
      ORDER BY p.urgente DESC, p.fecha_entrega, p.franja, p.hora_entrega, p.id`, fecha, fecha, ...cols);
  const columnas = cols.map((e) => ({ estado: e, pedidos: pedidos.filter((p) => p.estado === e) }));
  const atrasados = pedidos.filter((p) => p.fecha_entrega < fecha).length;
  const preparadores = todos('SELECT id, nombre FROM usuarios WHERE activo = 1 ORDER BY nombre');
  res.json({ fecha, columnas, atrasados, preparadores });
});

rutas.get('/entregas', (req, res) => {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || '')) ? String(req.query.fecha) : hoyLocal();
  const pedidos = todos(`SELECT p.*, d.nombre AS domiciliario_nombre, ${RESUMEN}
      FROM pedidos p LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id
      WHERE p.fecha_entrega = ? AND p.tipo_entrega = 'domicilio' AND p.estado IN ('confirmado','preparacion','listo','en_ruta','entregado')
      ORDER BY p.estado = 'entregado', p.urgente DESC, p.franja, p.hora_entrega, p.id`, fecha);
  const domiciliarios = todos('SELECT * FROM domiciliarios WHERE activo = 1 ORDER BY nombre');
  const porDomiciliario = domiciliarios.map((d) => ({ ...d, pedidos: pedidos.filter((p) => p.domiciliario_id === d.id) }));
  const sinAsignar = pedidos.filter((p) => !p.domiciliario_id);
  res.json({ fecha, pedidos, porDomiciliario, sinAsignar });
});
