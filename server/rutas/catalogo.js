import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { uno, todos, correr } from '../db.js';
import { requiere, hashClave } from '../auth.js';
import { transaccion } from '../db.js';
import { DIR_FOTOS } from '../config.js';
import { limpiar, entero, telefonoNormal } from '../util.js';

export const rutas = Router();
rutas.use(requiere());

const subirFoto = multer({
  storage: multer.diskStorage({
    destination: DIR_FOTOS,
    filename: (req, file, cb) => cb(null, `${req.params.id}${path.extname(file.originalname || '').toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// --- productos ---------------------------------------------------------------
rutas.get('/productos', (req, res) => {
  const todosLos = req.query.todos === '1' && req.usuario.rol === 'admin';
  res.json(todos(`SELECT * FROM productos ${todosLos ? '' : 'WHERE activo = 1'} ORDER BY categoria, orden, nombre`));
});
rutas.get('/categorias', (_req, res) => {
  const filas = todos("SELECT categoria FROM productos WHERE activo = 1 AND categoria IS NOT NULL");
  const set = new Set();
  for (const f of filas) for (const c of String(f.categoria).split(',')) set.add(c.trim());
  res.json([...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es')));
});
function nuevoId() {
  let n = 1; let id;
  do { id = `t${String(n).padStart(3, '0')}`; n++; } while (uno('SELECT id FROM productos WHERE id = ?', id));
  return id;
}
rutas.post('/productos', requiere('admin'), (req, res) => {
  const b = req.body || {};
  const nombre = limpiar(b.nombre, 120);
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });
  const id = limpiar(b.id, 20) || nuevoId();
  if (uno('SELECT id FROM productos WHERE id = ?', id)) return res.status(400).json({ error: 'Ese id ya existe' });
  correr('INSERT INTO productos(id, nombre, precio, precio_antes, categoria, descripcion, activo, orden) VALUES (?,?,?,?,?,?,?,?)',
    id, nombre, entero(b.precio), b.precio_antes ? entero(b.precio_antes) : null, limpiar(b.categoria, 80) || null, limpiar(b.descripcion, 500) || null, b.activo === false ? 0 : 1, entero(b.orden));
  res.json(uno('SELECT * FROM productos WHERE id = ?', id));
});
rutas.put('/productos/:id', requiere('admin'), (req, res) => {
  const p = uno('SELECT * FROM productos WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'No existe' });
  const b = req.body || {};
  correr(`UPDATE productos SET nombre = ?, precio = ?, precio_antes = ?, categoria = ?, descripcion = ?, activo = ?, orden = ?, actualizado_en = datetime('now') WHERE id = ?`,
    limpiar(b.nombre, 120) || p.nombre, b.precio !== undefined ? entero(b.precio) : p.precio,
    b.precio_antes === undefined ? p.precio_antes : (b.precio_antes ? entero(b.precio_antes) : null),
    b.categoria === undefined ? p.categoria : (limpiar(b.categoria, 80) || null),
    b.descripcion === undefined ? p.descripcion : (limpiar(b.descripcion, 500) || null),
    b.activo === undefined ? p.activo : (b.activo ? 1 : 0), b.orden === undefined ? p.orden : entero(b.orden), p.id);
  res.json(uno('SELECT * FROM productos WHERE id = ?', p.id));
});
rutas.post('/productos/:id/foto', requiere('admin'), subirFoto.single('foto'), (req, res) => {
  const p = uno('SELECT * FROM productos WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'No existe' });
  if (!req.file) return res.status(400).json({ error: 'Falta la foto' });
  if (p.imagen && p.imagen !== req.file.filename) { try { fs.unlinkSync(path.join(DIR_FOTOS, p.imagen)); } catch {} }
  correr('UPDATE productos SET imagen = ? WHERE id = ?', req.file.filename, p.id);
  res.json(uno('SELECT * FROM productos WHERE id = ?', p.id));
});
rutas.delete('/productos/:id', requiere('admin'), (req, res) => {
  // no se borra: se desactiva, porque los pedidos viejos lo referencian
  correr('UPDATE productos SET activo = 0 WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// --- zonas de domicilio --------------------------------------------------------
rutas.get('/zonas', (req, res) => {
  const todasLas = req.query.todas === '1';
  res.json(todos(`SELECT * FROM zonas ${todasLas ? '' : 'WHERE activo = 1'} ORDER BY zona COLLATE NOCASE`));
});
rutas.post('/zonas', requiere('admin'), (req, res) => {
  const zona = limpiar(req.body?.zona, 80);
  if (!zona) return res.status(400).json({ error: 'Falta el nombre de la zona' });
  try {
    const r = correr('INSERT INTO zonas(zona, precio) VALUES (?,?)', zona, req.body?.precio === null || req.body?.precio === '' ? null : entero(req.body?.precio));
    res.json(uno('SELECT * FROM zonas WHERE id = ?', Number(r.lastInsertRowid)));
  } catch (e) { res.status(400).json({ error: /UNIQUE/.test(e.message) ? 'Esa zona ya existe' : e.message }); }
});
rutas.put('/zonas/:id', requiere('admin'), (req, res) => {
  const z = uno('SELECT * FROM zonas WHERE id = ?', Number(req.params.id));
  if (!z) return res.status(404).json({ error: 'No existe' });
  const b = req.body || {};
  correr('UPDATE zonas SET zona = ?, precio = ?, activo = ? WHERE id = ?', limpiar(b.zona, 80) || z.zona,
    b.precio === undefined ? z.precio : (b.precio === null || b.precio === '' ? null : entero(b.precio)), b.activo === undefined ? z.activo : (b.activo ? 1 : 0), z.id);
  res.json(uno('SELECT * FROM zonas WHERE id = ?', z.id));
});
rutas.delete('/zonas/:id', requiere('admin'), (req, res) => {
  correr('UPDATE zonas SET activo = 0 WHERE id = ?', Number(req.params.id));
  res.json({ ok: true });
});

// --- domiciliarios -------------------------------------------------------------
// Cada domiciliario puede tener su propia cuenta (rol `domiciliario`): entra al
// sistema y ve solo sus entregas. Habilitar/deshabilitar apaga la cuenta también.
function domiciliarioCompleto(id) {
  return uno(`SELECT d.*, u.usuario, u.activo AS cuenta_activa FROM domiciliarios d LEFT JOIN usuarios u ON u.id = d.usuario_id WHERE d.id = ?`, id);
}
rutas.get('/domiciliarios', (req, res) => {
  res.json(todos(`SELECT d.*, u.usuario, u.activo AS cuenta_activa,
      (SELECT COUNT(*) FROM pedidos p WHERE p.domiciliario_id = d.id AND p.estado IN ('confirmado','preparacion','listo','en_ruta')) AS pendientes
      FROM domiciliarios d LEFT JOIN usuarios u ON u.id = d.usuario_id ${req.query.todos === '1' ? '' : 'WHERE d.activo = 1'} ORDER BY d.activo DESC, d.nombre`));
});
function crearCuenta(d, usuario, clave) {
  const u = limpiar(usuario, 60).toLowerCase().replace(/\s+/g, '');
  if (!u) throw new Error('Falta el usuario para la cuenta');
  if (String(clave || '').length < 6) throw new Error('La clave debe tener al menos 6 caracteres');
  if (uno('SELECT id FROM usuarios WHERE lower(usuario) = ?', u)) throw new Error('Ese usuario ya existe');
  const r = correr('INSERT INTO usuarios(usuario, nombre, clave_hash, rol, activo) VALUES (?,?,?,?,?)', u, d.nombre, hashClave(clave), 'domiciliario', d.activo);
  correr('UPDATE domiciliarios SET usuario_id = ? WHERE id = ?', Number(r.lastInsertRowid), d.id);
}
rutas.post('/domiciliarios', requiere('admin'), (req, res) => {
  const nombre = limpiar(req.body?.nombre, 80);
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });
  try {
    const id = transaccion(() => {
      const r = correr('INSERT INTO domiciliarios(nombre, telefono) VALUES (?,?)', nombre, telefonoNormal(req.body?.telefono) || null);
      const d = uno('SELECT * FROM domiciliarios WHERE id = ?', Number(r.lastInsertRowid));
      if (req.body?.usuario) crearCuenta(d, req.body.usuario, req.body.clave);
      return d.id;
    });
    res.json(domiciliarioCompleto(id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
rutas.put('/domiciliarios/:id', requiere('admin'), (req, res) => {
  const d = uno('SELECT * FROM domiciliarios WHERE id = ?', Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'No existe' });
  const b = req.body || {};
  const activo = b.activo === undefined ? d.activo : (b.activo ? 1 : 0);
  correr('UPDATE domiciliarios SET nombre = ?, telefono = ?, activo = ? WHERE id = ?', limpiar(b.nombre, 80) || d.nombre,
    b.telefono === undefined ? d.telefono : (telefonoNormal(b.telefono) || null), activo, d.id);
  if (d.usuario_id) {
    correr('UPDATE usuarios SET nombre = ?, activo = ? WHERE id = ?', limpiar(b.nombre, 80) || d.nombre, activo, d.usuario_id);
    if (!activo) correr('DELETE FROM sesiones WHERE usuario_id = ?', d.usuario_id);
  }
  res.json(domiciliarioCompleto(d.id));
});
// Crear la cuenta de un domiciliario existente, o cambiarle la clave.
rutas.post('/domiciliarios/:id/cuenta', requiere('admin'), (req, res) => {
  const d = uno('SELECT * FROM domiciliarios WHERE id = ?', Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'No existe' });
  try {
    if (d.usuario_id) {
      if (String(req.body?.clave || '').length < 6) return res.status(400).json({ error: 'La clave debe tener al menos 6 caracteres' });
      correr('UPDATE usuarios SET clave_hash = ? WHERE id = ?', hashClave(req.body.clave), d.usuario_id);
      correr('DELETE FROM sesiones WHERE usuario_id = ?', d.usuario_id);
    } else {
      crearCuenta(d, req.body?.usuario, req.body?.clave);
    }
    res.json(domiciliarioCompleto(d.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// --- clientes (CRM automático) --------------------------------------------------
rutas.get('/clientes', (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;
  res.json(todos(`SELECT c.*, COUNT(p.id) AS pedidos, COALESCE(SUM(CASE WHEN p.estado <> 'cancelado' THEN p.total END),0) AS valor,
      MAX(p.fecha_entrega) AS ultimo_pedido, MIN(p.fecha_entrega) AS primer_pedido
      FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id
      ${q ? 'WHERE c.nombre LIKE ? OR c.telefono LIKE ? OR c.email LIKE ?' : ''}
      GROUP BY c.id ORDER BY ultimo_pedido DESC, c.id DESC LIMIT 500`, ...(q ? [like, like, like] : [])));
});
rutas.post('/clientes', (req, res) => {
  const b = req.body || {};
  const tel = telefonoNormal(b.telefono);
  const nombre = limpiar(b.nombre, 80);
  if (!tel && !nombre) return res.status(400).json({ error: 'Ponga al menos el teléfono o el nombre' });
  if (tel && uno('SELECT id FROM clientes WHERE telefono = ?', tel)) return res.status(400).json({ error: 'Ya existe un cliente con ese teléfono' });
  const r = correr('INSERT INTO clientes(telefono, nombre, email, notas) VALUES (?,?,?,?)', tel || null, nombre || null, limpiar(b.email, 120) || null, limpiar(b.notas, 800) || null);
  res.json(uno('SELECT * FROM clientes WHERE id = ?', Number(r.lastInsertRowid)));
});
rutas.get('/clientes/:id', (req, res) => {
  const c = uno('SELECT * FROM clientes WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'No existe' });
  c.pedidos = todos(`SELECT p.*, (SELECT group_concat(i.cantidad || 'x ' || i.nombre, ' · ') FROM pedido_items i WHERE i.pedido_id = p.id) AS resumen_items
                     FROM pedidos p WHERE cliente_id = ? ORDER BY fecha_entrega DESC, id DESC`, c.id);
  c.fechas = todos('SELECT * FROM fechas_importantes WHERE cliente_id = ? ORDER BY dia_mes', c.id);
  c.valor = c.pedidos.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + p.total, 0);
  c.destinatarios = todos(`SELECT recibe_nombre, direccion, zona_nombre, COUNT(*) AS veces FROM pedidos WHERE cliente_id = ? AND recibe_nombre IS NOT NULL GROUP BY recibe_nombre, direccion ORDER BY veces DESC LIMIT 10`, c.id);
  res.json(c);
});
rutas.put('/clientes/:id', (req, res) => {
  const c = uno('SELECT * FROM clientes WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'No existe' });
  const b = req.body || {};
  correr('UPDATE clientes SET nombre = ?, email = ?, notas = ? WHERE id = ?', limpiar(b.nombre, 80) || c.nombre, b.email === undefined ? c.email : (limpiar(b.email, 120) || null), b.notas === undefined ? c.notas : (limpiar(b.notas, 800) || null), c.id);
  res.json(uno('SELECT * FROM clientes WHERE id = ?', c.id));
});
rutas.post('/clientes/:id/fechas', (req, res) => {
  const c = uno('SELECT id FROM clientes WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'No existe' });
  const { tipo, dia_mes, descripcion } = req.body || {};
  if (!/^\d{2}-\d{2}$/.test(String(dia_mes || ''))) return res.status(400).json({ error: 'Fecha inválida (MM-DD)' });
  correr('INSERT INTO fechas_importantes(cliente_id, tipo, dia_mes, descripcion) VALUES (?,?,?,?) ON CONFLICT(cliente_id, tipo, dia_mes) DO UPDATE SET descripcion = excluded.descripcion',
    c.id, limpiar(tipo, 30) || 'otro', dia_mes, limpiar(descripcion, 120) || null);
  res.json(todos('SELECT * FROM fechas_importantes WHERE cliente_id = ? ORDER BY dia_mes', c.id));
});
rutas.delete('/clientes/:id/fechas/:fid', (req, res) => {
  correr('DELETE FROM fechas_importantes WHERE id = ? AND cliente_id = ?', Number(req.params.fid), Number(req.params.id));
  res.json({ ok: true });
});
