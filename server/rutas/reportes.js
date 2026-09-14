// Reportes del negocio, exportación a Excel y cuadre de caja.
import { Router } from 'express';
import ExcelJS from 'exceljs';
import { todos, uno, correr, configCompleta } from '../db.js';
import { requiere } from '../auth.js';
import { hoyLocal, sumarDias, entero, limpiar } from '../util.js';

export const rutas = Router();
rutas.use(requiere());

function rango(req) {
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.hasta || '')) ? String(req.query.hasta) : hoyLocal();
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.desde || '')) ? String(req.query.desde) : sumarDias(hasta, -29);
  return { desde, hasta };
}

function datosReporte(desde, hasta) {
  const base = `FROM pedidos WHERE fecha_entrega >= ? AND fecha_entrega <= ? AND estado <> 'cancelado'`;
  const totales = uno(`SELECT COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS ventas, COALESCE(SUM(pagado),0) AS cobrado, COALESCE(AVG(total),0) AS ticket, COALESCE(SUM(domicilio_valor),0) AS domicilios ${base}`, desde, hasta);
  const porDia = todos(`SELECT fecha_entrega AS fecha, COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS ventas ${base} GROUP BY fecha_entrega ORDER BY fecha_entrega`, desde, hasta);
  const porSemana = todos(`SELECT strftime('%Y-W%W', fecha_entrega) AS semana, MIN(fecha_entrega) AS desde, COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS ventas ${base} GROUP BY semana ORDER BY semana`, desde, hasta);
  const porCanal = todos(`SELECT canal, COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS ventas ${base} GROUP BY canal ORDER BY ventas DESC`, desde, hasta);
  const porOrigen = todos(`SELECT origen, COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS ventas ${base} GROUP BY origen`, desde, hasta);
  const porEstado = todos(`SELECT estado, COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS ventas FROM pedidos WHERE fecha_entrega >= ? AND fecha_entrega <= ? GROUP BY estado`, desde, hasta);
  const porOcasion = todos(`SELECT COALESCE(ocasion,'sin_ocasion') AS ocasion, COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS ventas ${base} GROUP BY ocasion ORDER BY ventas DESC`, desde, hasta);
  const porMedio = todos(`SELECT medio, COUNT(*) AS pagos, COALESCE(SUM(monto),0) AS total FROM pagos WHERE substr(fecha,1,10) >= ? AND substr(fecha,1,10) <= ? AND anulado = 0 GROUP BY medio ORDER BY total DESC`, desde, hasta);
  const productos = todos(`SELECT i.nombre, SUM(i.cantidad) AS unidades, SUM(i.cantidad * i.precio) AS ventas FROM pedido_items i JOIN pedidos p ON p.id = i.pedido_id
      WHERE p.fecha_entrega >= ? AND p.fecha_entrega <= ? AND p.estado <> 'cancelado' GROUP BY i.nombre ORDER BY ventas DESC LIMIT 25`, desde, hasta);
  const porZona = todos(`SELECT COALESCE(zona_nombre,'(sin zona)') AS zona, COUNT(*) AS pedidos, COALESCE(SUM(domicilio_valor),0) AS domicilios ${base} AND tipo_entrega = 'domicilio' GROUP BY zona_nombre ORDER BY pedidos DESC LIMIT 25`, desde, hasta);
  const clientesTop = todos(`SELECT c.id, c.nombre, c.telefono, COUNT(p.id) AS pedidos, COALESCE(SUM(p.total),0) AS ventas FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
      WHERE p.fecha_entrega >= ? AND p.fecha_entrega <= ? AND p.estado <> 'cancelado' GROUP BY c.id ORDER BY ventas DESC LIMIT 15`, desde, hasta);
  const nuevosClientes = uno(`SELECT COUNT(*) AS n FROM clientes WHERE substr(creado_en,1,10) >= ? AND substr(creado_en,1,10) <= ?`, desde, hasta).n;
  const puntualidad = uno(`SELECT COUNT(*) AS entregados, SUM(CASE WHEN evidencia_foto IS NOT NULL THEN 1 ELSE 0 END) AS con_foto ${base} AND estado = 'entregado'`, desde, hasta);
  return { desde, hasta, totales, porDia, porSemana, porCanal, porOrigen, porEstado, porOcasion, porMedio, productos, porZona, clientesTop, nuevosClientes, puntualidad };
}

rutas.get('/', requiere('admin'), (req, res) => {
  const { desde, hasta } = rango(req);
  res.json(datosReporte(desde, hasta));
});

rutas.get('/excel', requiere('admin'), async (req, res) => {
  const { desde, hasta } = rango(req);
  const d = datosReporte(desde, hasta);
  const cfg = configCompleta();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TatiPOS';
  const estilo = (hoja) => {
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE84090' } };
    hoja.columns.forEach((c) => { c.width = Math.max(14, Math.min(50, (c.header?.length || 10) + 6)); });
  };
  const pesos = '"$"#,##0';

  const r = wb.addWorksheet('Resumen');
  r.addRows([
    ['Floristería Tati Ramos — Reporte de ventas'], [`Del ${desde} al ${hasta}`], [],
    ['Pedidos', d.totales.pedidos], ['Ventas', d.totales.ventas], ['Cobrado', d.totales.cobrado], ['Ticket promedio', Math.round(d.totales.ticket)],
    ['Domicilios cobrados', d.totales.domicilios], ['Clientes nuevos', d.nuevosClientes],
  ]);
  r.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFE84090' } };
  for (const f of [5, 6, 7, 8]) r.getCell(`B${f}`).numFmt = pesos;
  r.getColumn(1).width = 24; r.getColumn(2).width = 18;

  const hojas = [
    ['Ventas por día', [{ header: 'Fecha', key: 'fecha' }, { header: 'Pedidos', key: 'pedidos' }, { header: 'Ventas', key: 'ventas', style: { numFmt: pesos } }], d.porDia],
    ['Ventas por semana', [{ header: 'Semana', key: 'semana' }, { header: 'Desde', key: 'desde' }, { header: 'Pedidos', key: 'pedidos' }, { header: 'Ventas', key: 'ventas', style: { numFmt: pesos } }], d.porSemana],
    ['Por canal', [{ header: 'Canal', key: 'canal' }, { header: 'Pedidos', key: 'pedidos' }, { header: 'Ventas', key: 'ventas', style: { numFmt: pesos } }], d.porCanal.map((x) => ({ ...x, canal: (cfg.canales.find((c) => c.clave === x.canal) || {}).nombre || x.canal }))],
    ['Por estado', [{ header: 'Estado', key: 'estado' }, { header: 'Pedidos', key: 'pedidos' }, { header: 'Ventas', key: 'ventas', style: { numFmt: pesos } }], d.porEstado],
    ['Por ocasión', [{ header: 'Ocasión', key: 'ocasion' }, { header: 'Pedidos', key: 'pedidos' }, { header: 'Ventas', key: 'ventas', style: { numFmt: pesos } }], d.porOcasion],
    ['Medios de pago', [{ header: 'Medio', key: 'medio' }, { header: 'Pagos', key: 'pagos' }, { header: 'Total', key: 'total', style: { numFmt: pesos } }], d.porMedio],
    ['Productos', [{ header: 'Producto', key: 'nombre' }, { header: 'Unidades', key: 'unidades' }, { header: 'Ventas', key: 'ventas', style: { numFmt: pesos } }], d.productos],
    ['Zonas', [{ header: 'Zona', key: 'zona' }, { header: 'Pedidos', key: 'pedidos' }, { header: 'Domicilios', key: 'domicilios', style: { numFmt: pesos } }], d.porZona],
    ['Mejores clientes', [{ header: 'Cliente', key: 'nombre' }, { header: 'Teléfono', key: 'telefono' }, { header: 'Pedidos', key: 'pedidos' }, { header: 'Ventas', key: 'ventas', style: { numFmt: pesos } }], d.clientesTop],
  ];
  for (const [nombre, columnas, filas] of hojas) {
    const h = wb.addWorksheet(nombre); h.columns = columnas; h.addRows(filas); estilo(h);
  }
  const detalle = wb.addWorksheet('Pedidos');
  detalle.columns = [
    { header: 'Código', key: 'codigo' }, { header: 'Fecha entrega', key: 'fecha_entrega' }, { header: 'Estado', key: 'estado' }, { header: 'Canal', key: 'canal' },
    { header: 'Cliente', key: 'cliente_nombre' }, { header: 'Teléfono', key: 'cliente_telefono' }, { header: 'Recibe', key: 'recibe_nombre' }, { header: 'Zona', key: 'zona_nombre' },
    { header: 'Productos', key: 'resumen_items' }, { header: 'Subtotal', key: 'subtotal', style: { numFmt: pesos } }, { header: 'Domicilio', key: 'domicilio_valor', style: { numFmt: pesos } },
    { header: 'Recargo', key: 'recargo', style: { numFmt: pesos } }, { header: 'Descuento', key: 'descuento', style: { numFmt: pesos } }, { header: 'Total', key: 'total', style: { numFmt: pesos } },
    { header: 'Pagado', key: 'pagado', style: { numFmt: pesos } }, { header: 'Estado pago', key: 'estado_pago' }, { header: 'Ocasión', key: 'ocasion' }, { header: 'Creado', key: 'creado_en' },
  ];
  detalle.addRows(todos(`SELECT p.*, (SELECT group_concat(i.cantidad || 'x ' || i.nombre, ' · ') FROM pedido_items i WHERE i.pedido_id = p.id) AS resumen_items FROM pedidos p WHERE fecha_entrega >= ? AND fecha_entrega <= ? ORDER BY fecha_entrega, id`, desde, hasta));
  estilo(detalle);

  res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('content-disposition', `attachment; filename="TatiRamos-ventas-${desde}-a-${hasta}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// --- cuadre de caja --------------------------------------------------------------
rutas.get('/caja', (req, res) => {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || '')) ? String(req.query.fecha) : hoyLocal();
  const cfg = configCompleta();
  const pagos = todos(`SELECT pg.*, p.codigo, p.cliente_nombre, u.nombre AS registrado_por_nombre FROM pagos pg JOIN pedidos p ON p.id = pg.pedido_id LEFT JOIN usuarios u ON u.id = pg.registrado_por
      WHERE substr(pg.fecha,1,10) = ? AND pg.anulado = 0 ORDER BY pg.fecha`, fecha);
  const porMedio = {};
  for (const m of cfg.medios_pago) porMedio[m.clave] = { medio: m.clave, nombre: m.nombre, pagos: 0, total: 0 };
  for (const pg of pagos) {
    if (!porMedio[pg.medio]) porMedio[pg.medio] = { medio: pg.medio, nombre: pg.medio, pagos: 0, total: 0 };
    porMedio[pg.medio].pagos++; porMedio[pg.medio].total += pg.monto;
  }
  const cierre = uno('SELECT c.*, u.nombre AS cerrado_por_nombre FROM caja_cierres c LEFT JOIN usuarios u ON u.id = c.cerrado_por WHERE fecha = ?', fecha);
  if (cierre) { cierre.registrado = JSON.parse(cierre.registrado); cierre.recibido = JSON.parse(cierre.recibido); }
  const ventasDia = uno(`SELECT COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS total FROM pedidos WHERE fecha_entrega = ? AND estado <> 'cancelado'`, fecha);
  const pendiente = uno(`SELECT COALESCE(SUM(total - pagado),0) AS s FROM pedidos WHERE fecha_entrega = ? AND estado <> 'cancelado' AND estado_pago <> 'pagado'`, fecha).s;
  res.json({ fecha, pagos, porMedio: Object.values(porMedio), total: pagos.reduce((s, p) => s + p.monto, 0), cierre, ventasDia, pendiente });
});

rutas.post('/caja/cerrar', requiere('admin'), (req, res) => {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.fecha || '')) ? String(req.body.fecha) : hoyLocal();
  const recibido = {};
  for (const [k, v] of Object.entries(req.body?.recibido || {})) recibido[limpiar(k, 30)] = entero(v);
  const registrado = {};
  for (const r of todos(`SELECT medio, COALESCE(SUM(monto),0) AS total FROM pagos WHERE substr(fecha,1,10) = ? AND anulado = 0 GROUP BY medio`, fecha)) registrado[r.medio] = r.total;
  const totalReg = Object.values(registrado).reduce((s, v) => s + v, 0);
  const totalRec = Object.values(recibido).reduce((s, v) => s + v, 0);
  correr(`INSERT INTO caja_cierres(fecha, registrado, recibido, diferencia, notas, cerrado_por) VALUES (?,?,?,?,?,?)
          ON CONFLICT(fecha) DO UPDATE SET registrado = excluded.registrado, recibido = excluded.recibido, diferencia = excluded.diferencia, notas = excluded.notas, cerrado_por = excluded.cerrado_por, cerrado_en = datetime('now','localtime')`,
    fecha, JSON.stringify(registrado), JSON.stringify(recibido), totalRec - totalReg, limpiar(req.body?.notas, 500) || null, req.usuario.id);
  res.json({ ok: true, fecha, registrado, recibido, diferencia: totalRec - totalReg });
});

rutas.get('/caja/historial', requiere('admin'), (_req, res) => {
  const filas = todos('SELECT c.*, u.nombre AS cerrado_por_nombre FROM caja_cierres c LEFT JOIN usuarios u ON u.id = c.cerrado_por ORDER BY fecha DESC LIMIT 60');
  for (const c of filas) { c.registrado = JSON.parse(c.registrado); c.recibido = JSON.parse(c.recibido); }
  res.json(filas);
});
