// Cliente de la API. Todo va con la cookie de sesión.
export type Usuario = { id: number; usuario: string; nombre: string; rol: 'admin' | 'trabajador' | 'domiciliario'; domiciliario_id?: number | null };
export type Producto = { id: string; nombre: string; precio: number; precio_antes: number | null; categoria: string | null; imagen: string | null; descripcion: string | null; activo: number; orden: number };
export type Zona = { id: number; zona: string; precio: number | null; activo: number };
export type Domiciliario = { id: number; nombre: string; telefono: string | null; activo: number; usuario_id?: number | null; usuario?: string | null; cuenta_activa?: number | null; pendientes?: number };
export type Item = { id?: number; producto_id: string | null; nombre: string; cantidad: number; precio: number; nota?: string | null; imagen?: string | null };
export type Pago = { id: number; pedido_id?: number; fecha: string; medio: string; monto: number; comprobante: string | null; nota: string | null; registrado_por_nombre?: string; anulado: number };
export type Seguimiento = { id: number; tipo: string; telefono: string; programado_para: string; enviado_en: string | null; estado: string; error: string | null; mensaje: string; codigo?: string; cliente_nombre?: string; pedido_id?: number };
export type Pedido = {
  id: number; codigo: string; creado_en: string; actualizado_en: string; origen: 'pos' | 'bot'; canal: string; estado: string;
  cliente_id: number | null; cliente_nombre: string | null; cliente_telefono: string | null;
  tipo_entrega: 'domicilio' | 'recoge'; fecha_entrega: string; franja: string | null; hora_entrega: string | null;
  zona_id: number | null; zona_nombre: string | null; direccion: string | null; punto_referencia: string | null;
  recibe_nombre: string | null; recibe_telefono: string | null; tarjeta_para: string | null; tarjeta_mensaje: string | null; tarjeta_de: string | null;
  ocasion: string | null; funeraria: string | null; sala: string | null; fallecido: string | null; especificaciones: string | null; notas_internas: string | null;
  subtotal: number; domicilio_valor: number; recargo: number; descuento: number; total: number; pagado: number; estado_pago: 'pendiente' | 'abono' | 'pagado';
  preparador_id: number | null; preparador_nombre?: string | null; hora_lista: string | null; domiciliario_id: number | null; domiciliario_nombre?: string | null; domiciliario_telefono?: string | null;
  hora_salida: string | null; hora_entregado: string | null; evidencia_foto: string | null; urgente: number; bot_conv_id: string | null; cancelado_motivo: string | null;
  resumen_items?: string; creado_por_nombre?: string;
  items?: Item[]; pagos?: Pago[]; historial?: { id: number; ts: string; usuario_nombre: string | null; accion: string; detalle: string }[]; seguimientos?: Seguimiento[];
};
export type Franja = { clave: string; nombre: string; desde: string; hasta: string; capacidad: number };
export type Config = {
  negocio: Record<string, string | number>; franjas: Franja[];
  medios_pago: { clave: string; nombre: string; recargo: number; detalle?: string }[];
  canales: { clave: string; nombre: string }[]; ocasiones: { clave: string; nombre: string; recordar: boolean }[];
  seguimientos: { activo: boolean; confirmacion: boolean; entrega: boolean; pago_pendiente: boolean; pago_pendiente_horas: number; recompra: boolean; recompra_dias_antes: number; plantillas: Record<string, string> };
  whatsapp?: { url: string; apikey: string; instancia: string }; integracion_bot?: { apikey: string }; guia: { nota: string };
};
export type Cliente = { id: number; telefono: string | null; nombre: string | null; email: string | null; notas: string | null; direccion?: string | null; punto_referencia?: string | null; zona_id?: number | null; zona_nombre?: string | null; creado_en: string; pedidos?: number | Pedido[]; valor?: number; ultimo_pedido?: string | null; primer_pedido?: string | null; fechas?: { id: number; tipo: string; dia_mes: string; descripcion: string | null }[]; destinatarios?: { recibe_nombre: string; direccion: string; zona_nombre: string; veces: number }[] };

export class ErrorApi extends Error { estado: number; constructor(estado: number, mensaje: string) { super(mensaje); this.estado = estado; } }

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${ruta}`, { credentials: 'same-origin', ...opciones });
  if (r.status === 401 && !ruta.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent('sesion-vencida'));
  }
  const texto = await r.text();
  let datos: unknown = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = { error: texto }; }
  if (!r.ok) throw new ErrorApi(r.status, (datos as { error?: string })?.error || `Error ${r.status}`);
  return datos as T;
}
const json = (metodo: string, cuerpo?: unknown): RequestInit => ({ method: metodo, headers: { 'content-type': 'application/json' }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
const form = (metodo: string, datos: Record<string, string | Blob | undefined | null>): RequestInit => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(datos)) if (v !== undefined && v !== null) fd.append(k, v);
  return { method: metodo, body: fd };
};
const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  auth: {
    sesion: () => pedir<{ autenticado: boolean; usuario: Usuario | null }>('/auth/sesion'),
    login: (usuario: string, clave: string) => pedir<{ ok: true; usuario: Usuario }>('/auth/login', json('POST', { usuario, clave })),
    logout: () => pedir('/auth/logout', json('POST')),
    cambiarClave: (actual: string, nueva: string) => pedir('/auth/clave', json('POST', { actual, nueva })),
    usuarios: () => pedir<(Usuario & { activo: number; creado_en: string })[]>('/auth/usuarios'),
    crearUsuario: (d: { usuario: string; nombre: string; clave: string; rol: string }) => pedir('/auth/usuarios', json('POST', d)),
    editarUsuario: (id: number, d: Partial<{ nombre: string; rol: string; activo: boolean; clave: string }>) => pedir(`/auth/usuarios/${id}`, json('PUT', d)),
  },
  config: () => pedir<Config>('/config'),
  guardarConfig: (clave: string, valor: unknown) => pedir(`/config/${clave}`, json('PUT', { valor })),
  productos: (todos = false) => pedir<Producto[]>(`/productos${todos ? '?todos=1' : ''}`),
  categorias: () => pedir<string[]>('/categorias'),
  crearProducto: (d: Partial<Producto>) => pedir<Producto>('/productos', json('POST', d)),
  editarProducto: (id: string, d: Partial<Producto> & { activo?: boolean | number }) => pedir<Producto>(`/productos/${id}`, json('PUT', d)),
  fotoProducto: (id: string, foto: File) => pedir<Producto>(`/productos/${id}/foto`, form('POST', { foto })),
  zonas: (todas = false) => pedir<Zona[]>(`/zonas${todas ? '?todas=1' : ''}`),
  crearZona: (d: { zona: string; precio: number | null }) => pedir<Zona>('/zonas', json('POST', d)),
  editarZona: (id: number, d: Partial<{ zona: string; precio: number | null; activo: boolean }>) => pedir<Zona>(`/zonas/${id}`, json('PUT', d)),
  domiciliarios: (todos = false) => pedir<Domiciliario[]>(`/domiciliarios${todos ? '?todos=1' : ''}`),
  crearDomiciliario: (d: { nombre: string; telefono?: string; usuario?: string; clave?: string }) => pedir<Domiciliario>('/domiciliarios', json('POST', d)),
  cuentaDomiciliario: (id: number, d: { usuario?: string; clave: string }) => pedir<Domiciliario>(`/domiciliarios/${id}/cuenta`, json('POST', d)),
  misEntregas: () => pedir<Pedido[]>('/pedidos/mis-entregas'),
  editarDomiciliario: (id: number, d: Partial<{ nombre: string; telefono: string; activo: boolean }>) => pedir<Domiciliario>(`/domiciliarios/${id}`, json('PUT', d)),
  clientes: (q = '') => pedir<Cliente[]>(`/clientes${qs({ q })}`),
  cliente: (id: number) => pedir<Cliente & { pedidos: Pedido[] }>(`/clientes/${id}`),
  crearCliente: (d: { nombre: string; telefono: string; email?: string; notas?: string; direccion?: string; punto_referencia?: string; zona_id?: number | null; zona_nombre?: string }) => pedir<Cliente>('/clientes', json('POST', d)),
  editarCliente: (id: number, d: Partial<Cliente>) => pedir<Cliente>(`/clientes/${id}`, json('PUT', d)),
  agregarFecha: (id: number, d: { tipo: string; dia_mes: string; descripcion: string }) => pedir(`/clientes/${id}/fechas`, json('POST', d)),
  quitarFecha: (id: number, fid: number) => pedir(`/clientes/${id}/fechas/${fid}`, { method: 'DELETE' }),
  pedidos: (f: Record<string, string | number | undefined | null>) => pedir<Pedido[]>(`/pedidos${qs(f)}`),
  pedido: (id: number) => pedir<Pedido>(`/pedidos/${id}`),
  crearPedido: (d: unknown) => pedir<Pedido>('/pedidos', json('POST', d)),
  editarPedido: (id: number, d: unknown) => pedir<Pedido>(`/pedidos/${id}`, json('PUT', d)),
  cambiarEstado: (id: number, estado: string, motivo?: string) => pedir<Pedido>(`/pedidos/${id}/estado`, json('POST', { estado, motivo })),
  asignar: (id: number, d: Partial<{ preparador_id: number | null; domiciliario_id: number | null; hora_entrega: string; franja: string }>) => pedir<Pedido>(`/pedidos/${id}/asignar`, json('POST', d)),
  notas: (id: number, notas_internas: string) => pedir<Pedido>(`/pedidos/${id}/notas`, json('POST', { notas_internas })),
  registrarPago: (id: number, d: { medio: string; monto: number; nota?: string; fecha?: string; comprobante?: File | null }) => pedir<Pedido>(`/pedidos/${id}/pagos`, form('POST', { medio: d.medio, monto: String(d.monto), nota: d.nota, fecha: d.fecha, comprobante: d.comprobante })),
  anularPago: (id: number, pagoId: number) => pedir<Pedido>(`/pedidos/${id}/pagos/${pagoId}`, { method: 'DELETE' }),
  evidencia: (id: number, foto: File, entregar: boolean) => pedir<Pedido>(`/pedidos/${id}/evidencia`, form('POST', { foto, entregar: entregar ? '1' : '0' })),
  reintentarSeguimiento: (id: number, segId: number) => pedir<Pedido>(`/pedidos/${id}/seguimientos/${segId}/reintentar`, json('POST')),
  cancelarSeguimiento: (id: number, segId: number) => pedir<Pedido>(`/pedidos/${id}/seguimientos/${segId}/cancelar`, json('POST')),
  mensajeManual: (d: { pedido_id?: number; telefono?: string; mensaje: string }) => pedir('/seguimientos/manual', json('POST', d)),
  dashboard: (fecha?: string) => pedir<Dashboard>(`/dashboard${qs({ fecha })}`),
  agenda: (fecha?: string) => pedir<{ fecha: string; franjas: (Franja & { pedidos: Pedido[] })[]; sinFranja: Pedido[]; recogen: Pedido[]; total: number }>(`/agenda${qs({ fecha })}`),
  produccion: (fecha?: string) => pedir<{ fecha: string; columnas: { estado: string; pedidos: Pedido[] }[]; atrasados: number; preparadores: { id: number; nombre: string }[] }>(`/produccion${qs({ fecha })}`),
  entregas: (fecha?: string) => pedir<{ fecha: string; pedidos: Pedido[]; porDomiciliario: (Domiciliario & { pedidos: Pedido[] })[]; sinAsignar: Pedido[] }>(`/entregas${qs({ fecha })}`),
  reportes: (desde: string, hasta: string) => pedir<Reporte>(`/reportes${qs({ desde, hasta })}`),
  caja: (fecha?: string) => pedir<Caja>(`/reportes/caja${qs({ fecha })}`),
  cerrarCaja: (d: { fecha: string; recibido: Record<string, number>; notas: string }) => pedir('/reportes/caja/cerrar', json('POST', d)),
  historialCaja: () => pedir<{ id: number; fecha: string; registrado: Record<string, number>; recibido: Record<string, number>; diferencia: number; notas: string | null; cerrado_por_nombre: string | null; cerrado_en: string }[]>('/reportes/caja/historial'),
  seguimientos: (estado = '') => pedir<Seguimiento[]>(`/seguimientos${qs({ estado })}`),
  reintentarSeg: (id: number) => pedir(`/seguimientos/${id}/reintentar`, json('POST')),
  cancelarSeg: (id: number) => pedir(`/seguimientos/${id}/cancelar`, json('POST')),
  procesarSeguimientos: () => pedir<{ recompras_programadas: number }>('/seguimientos/procesar', json('POST')),
  whatsappEstado: () => pedir<{ configurado: boolean; estado: string }>('/whatsapp/estado'),
  whatsappPrueba: (telefono: string, texto: string) => pedir('/whatsapp/prueba', json('POST', { telefono, texto })),
  respaldar: () => pedir<{ archivo: string; respaldos: string[] }>('/respaldo', json('POST')),
  respaldos: () => pedir<{ archivo: string; bytes: number }[]>('/respaldo'),
  regenerarLlaveBot: () => pedir<{ apikey: string }>('/integraciones/bot/regenerar-llave', json('POST')),
};

export type Dashboard = {
  fecha: string; porEstado: Record<string, { n: number; total: number }>;
  ventasDia: { n: number; total: number; pagado: number }; cobradoHoy: { medio: string; total: number }[];
  pendientesPago: Pedido[]; nuevosSinConfirmar: Pedido[]; proximos: { fecha_entrega: string; n: number; total: number }[];
  enRuta: Pedido[]; semana: { n: number; total: number }; mes: { n: number; total: number };
  fechasProximas: { id: number; cliente_id: number; tipo: string; dia_mes: string; descripcion: string | null; cliente_nombre: string | null; telefono: string | null }[];
};
export type Reporte = {
  desde: string; hasta: string; totales: { pedidos: number; ventas: number; cobrado: number; ticket: number; domicilios: number };
  porDia: { fecha: string; pedidos: number; ventas: number }[]; porSemana: { semana: string; desde: string; pedidos: number; ventas: number }[];
  porCanal: { canal: string; pedidos: number; ventas: number }[]; porOrigen: { origen: string; pedidos: number; ventas: number }[];
  porEstado: { estado: string; pedidos: number; ventas: number }[]; porOcasion: { ocasion: string; pedidos: number; ventas: number }[];
  porMedio: { medio: string; pagos: number; total: number }[]; productos: { nombre: string; unidades: number; ventas: number }[];
  porZona: { zona: string; pedidos: number; domicilios: number }[]; clientesTop: { id: number; nombre: string; telefono: string; pedidos: number; ventas: number }[];
  nuevosClientes: number; puntualidad: { entregados: number; con_foto: number };
};
export type Caja = {
  fecha: string; pagos: (Pago & { codigo: string; cliente_nombre: string | null })[]; porMedio: { medio: string; nombre: string; pagos: number; total: number }[];
  total: number; cierre: { registrado: Record<string, number>; recibido: Record<string, number>; diferencia: number; notas: string | null; cerrado_por_nombre: string | null; cerrado_en: string } | null;
  ventasDia: { pedidos: number; total: number }; pendiente: number;
};
