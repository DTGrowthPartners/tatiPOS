// La hora del sistema es Colombia: los datetime('now','localtime') de SQLite y los Date de Node salen en hora local del negocio.
process.env.TZ = process.env.TZ || 'America/Bogota';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUERTO = Number(process.env.PUERTO || 3520);
export const DATA_DIR = process.env.DATA_DIR || path.join(RAIZ, 'data');
export const DIR_UPLOADS = path.join(DATA_DIR, 'uploads');
export const DIR_FOTOS = path.join(DATA_DIR, 'fotos');
export const DIR_CLIENTE = path.join(RAIZ, 'client', 'dist');
export const ZONA_HORARIA = 'America/Bogota';
export const COOKIE = 'tatipos_sesion';
export const DIAS_SESION = 30;
