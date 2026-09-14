import { Router } from 'express';
import { uno, correr, todos } from '../db.js';
import { verificarClave, crearSesion, cookieSesion, cookieBorrada, cerrarSesion, usuarioDeSesion, requiere, hashClave } from '../auth.js';
import { limpiar } from '../util.js';

export const rutas = Router();

rutas.post('/login', (req, res) => {
  const { usuario, clave } = req.body || {};
  const u = uno('SELECT * FROM usuarios WHERE lower(usuario) = lower(?) AND activo = 1', limpiar(usuario, 60));
  if (!u || !verificarClave(clave, u.clave_hash)) {
    return res.status(401).json({ error: 'Usuario o clave incorrectos' });
  }
  const token = crearSesion(u.id, req.headers['user-agent']);
  res.setHeader('set-cookie', cookieSesion(token, req));
  res.json({ ok: true, usuario: { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol } });
});

rutas.post('/logout', (req, res) => {
  cerrarSesion(req);
  res.setHeader('set-cookie', cookieBorrada());
  res.json({ ok: true });
});

rutas.get('/sesion', (req, res) => {
  const u = usuarioDeSesion(req);
  res.json({ autenticado: Boolean(u), usuario: u ? { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol } : null });
});

rutas.post('/clave', requiere(), (req, res) => {
  const { actual, nueva } = req.body || {};
  const u = uno('SELECT * FROM usuarios WHERE id = ?', req.usuario.id);
  if (!verificarClave(actual, u.clave_hash)) return res.status(400).json({ error: 'La clave actual no coincide' });
  if (String(nueva || '').length < 6) return res.status(400).json({ error: 'La clave nueva debe tener al menos 6 caracteres' });
  correr('UPDATE usuarios SET clave_hash = ? WHERE id = ?', hashClave(nueva), u.id);
  res.json({ ok: true });
});

// --- usuarios (admin) --------------------------------------------------------
rutas.get('/usuarios', requiere('admin'), (_req, res) => {
  res.json(todos('SELECT id, usuario, nombre, rol, activo, creado_en FROM usuarios ORDER BY id'));
});
rutas.post('/usuarios', requiere('admin'), (req, res) => {
  const { usuario, nombre, clave, rol } = req.body || {};
  if (!usuario || !nombre || !clave) return res.status(400).json({ error: 'Faltan datos' });
  if (!['admin', 'trabajador'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  if (String(clave).length < 6) return res.status(400).json({ error: 'La clave debe tener al menos 6 caracteres' });
  try {
    const r = correr('INSERT INTO usuarios(usuario, nombre, clave_hash, rol) VALUES (?,?,?,?)',
      limpiar(usuario, 60).toLowerCase(), limpiar(nombre, 80), hashClave(clave), rol);
    res.json({ ok: true, id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(400).json({ error: /UNIQUE/.test(e.message) ? 'Ese usuario ya existe' : e.message });
  }
});
rutas.put('/usuarios/:id', requiere('admin'), (req, res) => {
  const id = Number(req.params.id);
  const { nombre, rol, activo, clave } = req.body || {};
  const u = uno('SELECT * FROM usuarios WHERE id = ?', id);
  if (!u) return res.status(404).json({ error: 'No existe' });
  if (id === req.usuario.id && (activo === false || (rol && rol !== 'admin'))) {
    return res.status(400).json({ error: 'No puede quitarse su propio acceso de administrador' });
  }
  correr('UPDATE usuarios SET nombre = ?, rol = ?, activo = ? WHERE id = ?',
    limpiar(nombre || u.nombre, 80), ['admin', 'trabajador'].includes(rol) ? rol : u.rol, activo === undefined ? u.activo : (activo ? 1 : 0), id);
  if (clave) {
    if (String(clave).length < 6) return res.status(400).json({ error: 'La clave debe tener al menos 6 caracteres' });
    correr('UPDATE usuarios SET clave_hash = ? WHERE id = ?', hashClave(clave), id);
    correr('DELETE FROM sesiones WHERE usuario_id = ? AND token <> ?', id, req.usuario.token);
  }
  res.json({ ok: true });
});
