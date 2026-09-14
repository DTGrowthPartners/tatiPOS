// Envío por Evolution API (la misma instancia del bot de Tati). La URL, la
// apikey y la instancia se guardan en Configuración → WhatsApp.
import { leerConfig } from './db.js';
import { telefonoNormal } from './util.js';

export function configWhatsapp() {
  return { url: '', apikey: '', instancia: 'tatiramos', ...(leerConfig('whatsapp') || {}) };
}

export async function estadoInstancia() {
  const c = configWhatsapp();
  if (!c.url || !c.apikey) return { configurado: false, estado: 'sin configurar' };
  try {
    const r = await fetch(`${c.url.replace(/\/$/, '')}/instance/connectionState/${c.instancia}`, { headers: { apikey: c.apikey }, signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    return { configurado: true, estado: j?.instance?.state || `http ${r.status}` };
  } catch (e) {
    return { configurado: true, estado: `sin respuesta (${e.name})` };
  }
}

export async function enviarTexto(telefono, texto) {
  const c = configWhatsapp();
  if (!c.url || !c.apikey) throw new Error('WhatsApp sin configurar');
  const numero = telefonoNormal(telefono);
  if (!numero) throw new Error('teléfono vacío');
  const r = await fetch(`${c.url.replace(/\/$/, '')}/message/sendText/${c.instancia}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: c.apikey },
    body: JSON.stringify({ number: numero, text: texto, delay: 1200 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json().catch(() => ({}));
}
