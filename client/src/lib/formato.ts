export const pesos = (n: number | null | undefined) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

export function hoy(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
}
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function fechaLarga(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function fechaCorta(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function fechaHora(ts?: string | null): string {
  if (!ts) return '';
  const [f, h] = String(ts).split(' ');
  return `${fechaCorta(f)} ${String(h || '').slice(0, 5)}`;
}
export function relativa(fecha: string): string {
  const h = hoy();
  if (fecha === h) return 'Hoy';
  if (fecha === sumarDias(h, 1)) return 'Mañana';
  if (fecha === sumarDias(h, -1)) return 'Ayer';
  return fechaCorta(fecha);
}
export function telefonoBonito(t?: string | null): string {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) return `${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return t || '';
}
export function enlaceWa(t?: string | null, texto = ''): string {
  const d = String(t || '').replace(/\D/g, '');
  const n = d.length === 10 ? '57' + d : d;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}
export const iniciales = (n?: string | null) => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
