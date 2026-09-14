export type Estado = 'nuevo' | 'confirmado' | 'preparacion' | 'listo' | 'en_ruta' | 'entregado' | 'cancelado';
export const ESTADOS: Estado[] = ['nuevo', 'confirmado', 'preparacion', 'listo', 'en_ruta', 'entregado', 'cancelado'];
export const ESTADO: Record<Estado, { nombre: string; clase: string; punto: string; siguiente?: Estado; accion?: string }> = {
  nuevo:       { nombre: 'Nuevo',          clase: 'bg-amber-100 text-amber-800',   punto: 'bg-amber-500',   siguiente: 'confirmado',  accion: 'Confirmar' },
  confirmado:  { nombre: 'Confirmado',     clase: 'bg-sky-100 text-sky-800',       punto: 'bg-sky-500',     siguiente: 'preparacion', accion: 'Empezar a preparar' },
  preparacion: { nombre: 'En preparación', clase: 'bg-violet-100 text-violet-800', punto: 'bg-violet-500',  siguiente: 'listo',       accion: 'Marcar listo' },
  listo:       { nombre: 'Listo',          clase: 'bg-teal-100 text-teal-800',     punto: 'bg-teal-500',    siguiente: 'en_ruta',     accion: 'Salió a ruta' },
  en_ruta:     { nombre: 'En ruta',        clase: 'bg-orange-100 text-orange-800', punto: 'bg-orange-500',  siguiente: 'entregado',   accion: 'Entregado' },
  entregado:   { nombre: 'Entregado',      clase: 'bg-green-100 text-green-800',   punto: 'bg-green-600' },
  cancelado:   { nombre: 'Cancelado',      clase: 'bg-gray-200 text-gray-700',     punto: 'bg-gray-500' },
};
export const PAGO: Record<string, { nombre: string; clase: string }> = {
  pendiente: { nombre: 'Sin pago', clase: 'bg-red-100 text-red-700' },
  abono: { nombre: 'Abono', clase: 'bg-amber-100 text-amber-800' },
  pagado: { nombre: 'Pagado', clase: 'bg-green-100 text-green-800' },
};
export const SEGUIMIENTO: Record<string, string> = { confirmacion: 'Confirmación', entrega: 'Entrega', pago_pendiente: 'Pago pendiente', recompra: 'Recompra', manual: 'Mensaje manual' };
