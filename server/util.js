import { ZONA_HORARIA } from './config.js';

/** Fecha/hora local Colombia como 'YYYY-MM-DD HH:MM:SS'. */
export function ahoraLocal(d = new Date()) {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
  return p.replace('T', ' ');
}
export function hoyLocal() { return ahoraLocal().slice(0, 10); }
export function horaLocal() { return ahoraLocal().slice(11, 16); }

export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function pesos(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

export function fechaBonita(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function soloDigitos(t) { return String(t || '').replace(/\D/g, ''); }

/** Teléfono colombiano normalizado a 57XXXXXXXXXX (o tal cual si es internacional). */
export function telefonoNormal(t) {
  const d = soloDigitos(t);
  if (!d) return '';
  if (d.length === 10 && d.startsWith('3')) return '57' + d;
  return d;
}

export function limpiar(t, max = 500) { return String(t ?? '').trim().slice(0, max); }
export function entero(n, def = 0) { const v = Math.round(Number(n)); return Number.isFinite(v) ? v : def; }
