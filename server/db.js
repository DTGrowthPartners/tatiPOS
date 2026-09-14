// Base de datos: SQLite con el módulo nativo de Node (sin compilar nada).
// Un solo archivo en data/tatipos.db; WAL para que lecturas y escrituras no se
// bloqueen entre el mostrador y el celular.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
export const db = new DatabaseSync(path.join(DATA_DIR, 'tatipos.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  clave_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin','trabajador')),
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  expira_en TEXT NOT NULL,
  agente TEXT
);
CREATE TABLE IF NOT EXISTS productos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio INTEGER NOT NULL DEFAULT 0,
  precio_antes INTEGER,
  categoria TEXT,
  imagen TEXT,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS zonas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zona TEXT NOT NULL UNIQUE,
  precio INTEGER,
  activo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS domiciliarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefono TEXT UNIQUE,
  nombre TEXT,
  email TEXT,
  notas TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  creado_por INTEGER REFERENCES usuarios(id),
  origen TEXT NOT NULL DEFAULT 'pos',          -- pos | bot
  canal TEXT NOT NULL DEFAULT 'whatsapp',      -- whatsapp | instagram | web | punto | telefono | otro
  estado TEXT NOT NULL DEFAULT 'nuevo',        -- nuevo | confirmado | preparacion | listo | en_ruta | entregado | cancelado
  cliente_id INTEGER REFERENCES clientes(id),
  cliente_nombre TEXT,
  cliente_telefono TEXT,
  tipo_entrega TEXT NOT NULL DEFAULT 'domicilio', -- domicilio | recoge
  fecha_entrega TEXT,                          -- YYYY-MM-DD
  franja TEXT,                                 -- clave de franja (config)
  hora_entrega TEXT,                           -- hora puntual acordada (opcional)
  zona_id INTEGER REFERENCES zonas(id),
  zona_nombre TEXT,
  direccion TEXT,
  punto_referencia TEXT,
  recibe_nombre TEXT,
  recibe_telefono TEXT,
  tarjeta_para TEXT,
  tarjeta_mensaje TEXT,
  tarjeta_de TEXT,
  ocasion TEXT,                                -- cumpleanos | amor | aniversario | funebre | nacimiento | grado | agradecimiento | otro
  funeraria TEXT,
  sala TEXT,
  fallecido TEXT,
  especificaciones TEXT,
  notas_internas TEXT,
  subtotal INTEGER NOT NULL DEFAULT 0,
  domicilio_valor INTEGER NOT NULL DEFAULT 0,
  recargo INTEGER NOT NULL DEFAULT 0,
  descuento INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  pagado INTEGER NOT NULL DEFAULT 0,
  estado_pago TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | abono | pagado
  preparador_id INTEGER REFERENCES usuarios(id),
  hora_lista TEXT,
  domiciliario_id INTEGER REFERENCES domiciliarios(id),
  hora_salida TEXT,
  hora_entregado TEXT,
  evidencia_foto TEXT,
  urgente INTEGER NOT NULL DEFAULT 0,
  bot_conv_id TEXT,
  bot_pedido_id TEXT,
  cancelado_motivo TEXT
);
CREATE INDEX IF NOT EXISTS ix_pedidos_fecha ON pedidos(fecha_entrega);
CREATE INDEX IF NOT EXISTS ix_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS ix_pedidos_cliente ON pedidos(cliente_id);
CREATE TABLE IF NOT EXISTS pedido_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id TEXT REFERENCES productos(id),
  nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio INTEGER NOT NULL DEFAULT 0,
  nota TEXT
);
CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  medio TEXT NOT NULL,
  monto INTEGER NOT NULL,
  comprobante TEXT,
  nota TEXT,
  registrado_por INTEGER REFERENCES usuarios(id),
  anulado INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_pagos_fecha ON pagos(fecha);
CREATE TABLE IF NOT EXISTS pedido_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  ts TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  usuario_id INTEGER REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  detalle TEXT
);
CREATE TABLE IF NOT EXISTS caja_cierres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL UNIQUE,
  registrado TEXT NOT NULL,      -- JSON {medio: monto}
  recibido TEXT NOT NULL,        -- JSON {medio: monto}
  diferencia INTEGER NOT NULL DEFAULT 0,
  notas TEXT,
  cerrado_por INTEGER REFERENCES usuarios(id),
  cerrado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS seguimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id),
  tipo TEXT NOT NULL,            -- confirmacion | entrega | pago_pendiente | recompra
  telefono TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  programado_para TEXT NOT NULL,
  enviado_en TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | enviado | fallido | cancelado
  error TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_seg_prog ON seguimientos(estado, programado_para);
CREATE TABLE IF NOT EXISTS fechas_importantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  dia_mes TEXT NOT NULL,         -- MM-DD
  descripcion TEXT,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
  UNIQUE(cliente_id, tipo, dia_mes)
);
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`);

// --- helpers -----------------------------------------------------------------
export function uno(sql, ...params) { return db.prepare(sql).get(...params); }
export function todos(sql, ...params) { return db.prepare(sql).all(...params); }
export function correr(sql, ...params) { return db.prepare(sql).run(...params); }
export function transaccion(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function leerConfig(clave, porDefecto = null) {
  const r = uno('SELECT valor FROM config WHERE clave = ?', clave);
  if (!r) return porDefecto;
  try { return JSON.parse(r.valor); } catch { return porDefecto; }
}
export function guardarConfig(clave, valor) {
  correr('INSERT INTO config(clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
    clave, JSON.stringify(valor));
}

// Configuración por defecto: lo que la floristería dijo en el onboarding y en
// los chats reales (negocio.md del bot). Todo se edita desde Configuración.
export const CONFIG_DEFECTO = {
  negocio: {
    nombre: 'Floristería Tati Ramos',
    ciudad: 'Cartagena',
    direccion: 'Av. Consulado, detrás de La Castellana, pasos adelante de la Olímpica',
    mapa: 'https://maps.google.com/maps?q=10.39288330078125%2C-75.4878158569336&z=17&hl=es',
    telefono: '3157557610',
    web: 'https://floristeriatatianaramos.com',
    instagram: 'floristeriatatiramoscartagena',
    horario: 'Lun–Sáb 7:00 a 20:00 · Dom y festivos 8:00 a 17:00',
    ultimo_domicilio: '19:00',
    horas_pago_antes: 3,
  },
  franjas: [
    { clave: 'manana', nombre: 'Mañana', desde: '08:30', hasta: '11:00', capacidad: 8 },
    { clave: 'mediodia', nombre: 'Mediodía', desde: '11:00', hasta: '14:00', capacidad: 8 },
    { clave: 'tarde', nombre: 'Tarde', desde: '14:00', hasta: '17:00', capacidad: 8 },
    { clave: 'noche', nombre: 'Final del día', desde: '17:00', hasta: '19:00', capacidad: 6 },
  ],
  medios_pago: [
    { clave: 'efectivo', nombre: 'Efectivo', recargo: 0 },
    { clave: 'bancolombia', nombre: 'Bancolombia', recargo: 0, detalle: 'Cta. corriente 78800001576 · Tatiana Ramos Rincón · CC 1098757274' },
    { clave: 'nequi', nombre: 'Nequi', recargo: 0, detalle: '3157557610 · Tatiana Ramos' },
    { clave: 'daviplata', nombre: 'Daviplata', recargo: 0, detalle: '3157557610' },
    { clave: 'davivienda', nombre: 'Davivienda', recargo: 0, detalle: 'Ahorros 057300314457 · Tatiana Paola Ramos Rincón' },
    { clave: 'breb', nombre: 'Llaves Bre-B', recargo: 0, detalle: '3157557610 · 3147796695' },
    { clave: 'tarjeta', nombre: 'Tarjeta (link de pago)', recargo: 6 },
    { clave: 'paypal', nombre: 'PayPal', recargo: 6 },
    { clave: 'otro', nombre: 'Otro', recargo: 0 },
  ],
  canales: [
    { clave: 'whatsapp', nombre: 'WhatsApp' },
    { clave: 'instagram', nombre: 'Instagram' },
    { clave: 'web', nombre: 'Página web' },
    { clave: 'punto', nombre: 'Punto físico' },
    { clave: 'telefono', nombre: 'Llamada' },
    { clave: 'otro', nombre: 'Otro' },
  ],
  ocasiones: [
    { clave: 'cumpleanos', nombre: 'Cumpleaños', recordar: true },
    { clave: 'amor', nombre: 'Amor y amistad', recordar: false },
    { clave: 'aniversario', nombre: 'Aniversario', recordar: true },
    { clave: 'funebre', nombre: 'Fúnebre', recordar: false },
    { clave: 'nacimiento', nombre: 'Nacimiento', recordar: false },
    { clave: 'grado', nombre: 'Grado', recordar: false },
    { clave: 'madre', nombre: 'Día de la madre', recordar: false },
    { clave: 'agradecimiento', nombre: 'Agradecimiento', recordar: false },
    { clave: 'otro', nombre: 'Otro', recordar: false },
  ],
  seguimientos: {
    activo: false,               // se enciende cuando Tati apruebe los textos
    confirmacion: true,
    entrega: true,
    pago_pendiente: true,
    pago_pendiente_horas: 2,     // aviso si sigue sin pago a X horas de creado
    recompra: true,
    recompra_dias_antes: 5,
    plantillas: {
      confirmacion: 'Hola {nombre} 🌸 Su pedido #{codigo} quedó confirmado para el {fecha} ({franja}). Total: {total}. En cuanto salga a ruta le avisamos. ¡Gracias por elegir Floristería Tati Ramos!',
      entrega: '¡Su pedido #{codigo} fue entregado! 🌷 Esperamos que haya sido una sorpresa hermosa. Si nos regala una foto o una reseña nos ayuda muchísimo. Gracias por confiar en Floristería Tati Ramos 🙏',
      pago_pendiente: 'Hola {nombre}, le recordamos que el pedido #{codigo} para el {fecha} aún está pendiente de pago ({pendiente}). Para preparar el arreglo a tiempo necesitamos el pago mínimo 3 horas antes 🌸',
      recompra: 'Hola {nombre} 🌸 Se acerca una fecha especial ({ocasion}, {fecha}). ¿Le gustaría que le preparemos un detalle como el del año pasado? Escríbanos y lo dejamos agendado.',
    },
  },
  whatsapp: {
    // Evolution API de la instancia del bot (315 7557610). Se llena en Configuración.
    url: '', apikey: '', instancia: 'tatiramos',
  },
  integracion_bot: { apikey: '' },
  guia: { nota: 'El domiciliario llama cuando esté cerca. Todo arreglo incluye tarjeta con mensaje.' },
};

for (const [k, v] of Object.entries(CONFIG_DEFECTO)) {
  if (leerConfig(k) === null) guardarConfig(k, v);
}
export function configCompleta() {
  const salida = {};
  for (const k of Object.keys(CONFIG_DEFECTO)) salida[k] = { ...CONFIG_DEFECTO[k], ...(leerConfig(k) || {}) };
  // los arrays no se mezclan, se reemplazan
  for (const k of ['franjas', 'medios_pago', 'canales', 'ocasiones']) salida[k] = leerConfig(k) || CONFIG_DEFECTO[k];
  return salida;
}
