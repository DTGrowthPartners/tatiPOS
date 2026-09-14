// Copia íntegra de la base (VACUUM INTO) en data/respaldos, conserva 30. Cron diario.
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db.js';
import { DATA_DIR } from '../server/config.js';
const dir = path.join(DATA_DIR, 'respaldos'); fs.mkdirSync(dir, { recursive: true });
const destino = path.join(dir, `tatipos-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.db`);
db.exec(`VACUUM INTO '${destino}'`);
const lista = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse();
for (const viejo of lista.slice(30)) fs.unlinkSync(path.join(dir, viejo));
console.log('respaldo', path.basename(destino), fs.statSync(destino).size, 'bytes');
