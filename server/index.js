import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { PUERTO, DIR_UPLOADS, DIR_FOTOS, DIR_CLIENTE } from './config.js';
import { db, uno } from './db.js';
import { requiere, hashClave } from './auth.js';
import { rutas as auth } from './rutas/auth.js';
import { rutas as pedidos } from './rutas/pedidos.js';
import { rutas as catalogo } from './rutas/catalogo.js';
import { rutas as operacion } from './rutas/operacion.js';
import { rutas as reportes } from './rutas/reportes.js';
import { rutas as sistema } from './rutas/sistema.js';
import { procesarCola, programarRecompras } from './seguimientos.js';
import { hoyLocal } from './util.js';

fs.mkdirSync(DIR_UPLOADS, { recursive: true });
fs.mkdirSync(DIR_FOTOS, { recursive: true });

// Primer arranque sin usuarios: admin/admin123 para poder entrar (cambiar en Configuración → Usuarios).
if (!uno('SELECT id FROM usuarios LIMIT 1')) {
  db.prepare('INSERT INTO usuarios(usuario, nombre, clave_hash, rol) VALUES (?,?,?,?)').run('admin', 'Administrador', hashClave('admin123'), 'admin');
  console.log('usuario inicial creado: admin / admin123');
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/api/salud', (_req, res) => res.json({ ok: true, hoy: hoyLocal() }));
app.use('/api/auth', auth);
// `sistema` va antes que los routers con guard global: ahí vive la integración
// con el bot, que autentica por llave y no por sesión.
app.use('/api', sistema);
app.use('/api/pedidos', pedidos);
app.use('/api/reportes', reportes);
app.use('/api', catalogo);
app.use('/api', operacion);

// Archivos: fotos de catálogo (públicas para el que tenga sesión) y adjuntos
app.use('/fotos', requiere('admin', 'trabajador', 'domiciliario'), express.static(DIR_FOTOS, { maxAge: '7d' }));
app.use('/uploads', requiere('admin', 'trabajador', 'domiciliario'), express.static(DIR_UPLOADS, { maxAge: '7d' }));

app.use('/api', (req, res) => res.status(404).json({ error: `no existe ${req.method} ${req.path}` }));

// SPA
app.use(express.static(DIR_CLIENTE, { index: false, maxAge: '1h' }));
app.get(/.*/, (req, res) => {
  const index = path.join(DIR_CLIENTE, 'index.html');
  if (!fs.existsSync(index)) return res.status(503).send('TatiPOS: el cliente no está compilado (npm run build)');
  res.setHeader('cache-control', 'no-cache');
  res.sendFile(index);
});

app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'El archivo es muy pesado' });
  console.error(err);
  res.status(500).json({ error: err.message || 'error interno' });
});

app.listen(PUERTO, '127.0.0.1', () => console.log(`TatiPOS escuchando en http://127.0.0.1:${PUERTO}`));

// Reloj: cola de seguimientos cada minuto; recompras una vez al día (a las 8:05)
setInterval(() => procesarCola().catch((e) => console.error('seguimientos:', e.message)), 60_000);
let ultimoDiaRecompra = '';
setInterval(() => {
  const hoy = hoyLocal();
  const hora = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false }).slice(0, 5);
  if (hoy !== ultimoDiaRecompra && hora >= '08:05') { ultimoDiaRecompra = hoy; try { programarRecompras(); } catch (e) { console.error('recompras:', e.message); } }
}, 60_000);
