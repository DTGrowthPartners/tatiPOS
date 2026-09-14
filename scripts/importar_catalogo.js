// Carga inicial desde los datos del bot de Chatsuite de Tati Ramos.
// Idempotente: actualiza precios/nombres, no duplica. Uso: node scripts/importar_catalogo.js
import fs from 'node:fs';
import path from 'node:path';
import { db, correr, uno } from '../server/db.js';
import { DIR_FOTOS } from '../server/config.js';
import { hashClave } from '../server/auth.js';

const ORIGEN = process.env.ORIGEN_BOT || '/srv/chatsuite/tatiramos/bot/data';
const leer = (f) => JSON.parse(fs.readFileSync(path.join(ORIGEN, f), 'utf8'));

let n = 0;
for (const p of leer('catalogo.json')) {
  if (!p.id || !p.nombre) continue;
  const foto = p.imagen && fs.existsSync(path.join(ORIGEN, 'catalogo-fotos', p.imagen)) ? p.imagen : null;
  if (foto) fs.copyFileSync(path.join(ORIGEN, 'catalogo-fotos', foto), path.join(DIR_FOTOS, foto));
  correr(`INSERT INTO productos(id, nombre, precio, precio_antes, categoria, imagen, descripcion) VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, precio = excluded.precio, precio_antes = excluded.precio_antes, categoria = excluded.categoria, imagen = COALESCE(excluded.imagen, productos.imagen)`,
    String(p.id), String(p.nombre).trim(), Math.round(Number(p.precio) || 0), p.antes ? Math.round(Number(p.antes)) : null, p.categoria || null, foto, p.nota || null);
  n++;
}
console.log(`productos: ${n}`);

// Precios sueltos que la floristería da por chat y no están en la web (negocio.md)
const sueltos = [
  ['s001', 'Rosa natural (unidad)', 8000, 'Flores sueltas'], ['s002', 'Docena de rosas', 96000, 'Flores sueltas'],
  ['s003', 'Ramillete 15 rosas rojas', 75000, 'Flores sueltas'], ['s004', 'Ramillete 20 rosas', 95000, 'Flores sueltas'],
  ['s005', 'Bouquet 24 rosas rojas', 100000, 'Bouquet'], ['s006', 'Bouquet lirios con rosas surtidas', 130000, 'Bouquet'],
  ['s007', 'Paquete rosas rosadas sin decorar', 70000, 'Flores sueltas'],
  ['s010', 'Cinta personalizada (corona/ramo)', 25000, 'Adicionales'], ['s011', 'Globo adicional', 12000, 'Adicionales'],
  ['s012', 'Ferrero Rocher x3', 17000, 'Chocolates y Adicionales'], ['s013', 'Ferrero Rocher x8', 33000, 'Chocolates y Adicionales'],
  ['s014', 'Ferrero corazón x8', 38000, 'Chocolates y Adicionales'], ['s020', 'Arreglo personalizado (precio a convenir)', 0, 'Personalizado'],
];
for (const [id, nombre, precio, cat] of sueltos) {
  correr(`INSERT INTO productos(id, nombre, precio, categoria) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING`, id, nombre, precio, cat);
}

let z = 0;
for (const d of leer('domicilios.json')) {
  if (!d.zona) continue;
  correr(`INSERT INTO zonas(zona, precio, activo) VALUES (?,?,?) ON CONFLICT(zona) DO UPDATE SET precio = excluded.precio`, String(d.zona).trim(), d.precio == null ? null : Math.round(Number(d.precio)), d.precio == null ? 0 : 1);
  z++;
}
console.log(`zonas: ${z}`);

for (const nombre of ['Don Heber', 'Ferney']) {
  if (!uno('SELECT id FROM domiciliarios WHERE nombre = ?', nombre)) correr('INSERT INTO domiciliarios(nombre) VALUES (?)', nombre);
}

// Usuarios: admin (Tati) y trabajador (Pao). Las claves iniciales salen por consola y se cambian en el sistema.
const usuarios = [
  ['tati', 'Tatiana Ramos', 'admin', process.env.CLAVE_ADMIN || 'TatiRamos2026*'],
  ['pao', 'Paola Ruiz', 'trabajador', process.env.CLAVE_TRABAJADOR || 'Flores2026*'],
];
for (const [usuario, nombre, rol, clave] of usuarios) {
  if (!uno('SELECT id FROM usuarios WHERE usuario = ?', usuario)) {
    correr('INSERT INTO usuarios(usuario, nombre, clave_hash, rol) VALUES (?,?,?,?)', usuario, nombre, hashClave(clave), rol);
    console.log(`usuario creado: ${usuario} / ${clave} (${rol})`);
  }
}
// El admin genérico del primer arranque sobra si ya existe tati
if (uno("SELECT id FROM usuarios WHERE usuario = 'tati'") && uno("SELECT id FROM usuarios WHERE usuario = 'admin'")) {
  correr("DELETE FROM usuarios WHERE usuario = 'admin'"); console.log('usuario admin genérico eliminado');
}
db.close();
