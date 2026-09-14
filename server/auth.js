// Sesiones con cookie opaca guardada en la base. scrypt del propio Node para
// las claves: sin dependencias y suficiente para dos usuarios.
import crypto from 'node:crypto';
import { db, uno, correr } from './db.js';
import { COOKIE, DIAS_SESION } from './config.js';

export function hashClave(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(clave), sal, 64).toString('hex');
  return `${sal}:${h}`;
}
export function verificarClave(clave, guardado) {
  const [sal, h] = String(guardado || '').split(':');
  if (!sal || !h) return false;
  const calc = crypto.scryptSync(String(clave), sal, 64);
  const ref = Buffer.from(h, 'hex');
  return calc.length === ref.length && crypto.timingSafeEqual(calc, ref);
}

export function crearSesion(usuarioId, agente) {
  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + DIAS_SESION * 86400e3).toISOString();
  correr('INSERT INTO sesiones(token, usuario_id, expira_en, agente) VALUES (?,?,?,?)', token, usuarioId, expira, agente || '');
  return token;
}

export function cookieSesion(token, req) {
  const segura = (req.headers['x-forwarded-proto'] || req.protocol) === 'https';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DIAS_SESION * 86400}${segura ? '; Secure' : ''}`;
}
export function cookieBorrada() { return `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`; }

function leerCookie(req) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`));
  return m ? m[1] : null;
}

export function usuarioDeSesion(req) {
  const token = leerCookie(req);
  if (!token) return null;
  const s = uno(`SELECT u.id, u.usuario, u.nombre, u.rol, u.activo, s.expira_en
                 FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ?`, token);
  if (!s || !s.activo || s.expira_en < new Date().toISOString()) return null;
  return { id: s.id, usuario: s.usuario, nombre: s.nombre, rol: s.rol, token };
}

export function cerrarSesion(req) {
  const token = leerCookie(req);
  if (token) correr('DELETE FROM sesiones WHERE token = ?', token);
}

/** Middleware: exige sesión; con rol, exige ese rol. */
export function requiere(rol) {
  return (req, res, next) => {
    const u = usuarioDeSesion(req);
    if (!u) return res.status(401).json({ error: 'Inicie sesión' });
    if (rol && u.rol !== rol) return res.status(403).json({ error: 'Solo el administrador puede hacer esto' });
    req.usuario = u;
    next();
  };
}

// Limpieza de sesiones vencidas al arrancar
db.exec(`DELETE FROM sesiones WHERE expira_en < '${new Date().toISOString()}'`);
