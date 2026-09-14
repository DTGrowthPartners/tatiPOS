import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Config, type Zona, type Domiciliario, type Usuario } from '../api';
import { useSesion } from '../App';
import { Encabezado, Campo, Modal, useToast, Insignia } from '../componentes/ui';
import { pesos, telefonoBonito } from '../lib/formato';

const TABS = [['negocio', 'Negocio'], ['franjas', 'Franjas'], ['zonas', 'Zonas'], ['domiciliarios', 'Domiciliarios'], ['pagos', 'Medios de pago'], ['mensajes', 'Mensajes'], ['usuarios', 'Usuarios'], ['sistema', 'Sistema']] as const;

export default function Configuracion() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'negocio';
  const { config, recargarConfig } = useSesion();
  const { avisar } = useToast();
  const guardar = async (clave: string, valor: unknown) => { try { await api.guardarConfig(clave, valor); await recargarConfig(); avisar('Configuración guardada'); } catch (e) { avisar((e as Error).message, 'error'); } };
  if (!config) return null;
  return (
    <div className="space-y-4">
      <Encabezado titulo="Configuración" />
      <div className="flex gap-1.5 flex-wrap">{TABS.map(([k, t]) => <button key={k} onClick={() => setSp({ tab: k })} className={`insignia py-1.5 px-3 text-sm cursor-pointer ${tab === k ? 'bg-rosa-500 text-white' : 'bg-white border border-rosa-200'}`}>{t}</button>)}</div>
      {tab === 'negocio' ? <Negocio config={config} guardar={guardar} /> : null}
      {tab === 'franjas' ? <Franjas config={config} guardar={guardar} /> : null}
      {tab === 'zonas' ? <Zonas /> : null}
      {tab === 'domiciliarios' ? <Domiciliarios /> : null}
      {tab === 'pagos' ? <MediosPago config={config} guardar={guardar} /> : null}
      {tab === 'mensajes' ? <Mensajes config={config} guardar={guardar} /> : null}
      {tab === 'usuarios' ? <Usuarios /> : null}
      {tab === 'sistema' ? <Sistema config={config} guardar={guardar} /> : null}
    </div>
  );
}

function Negocio({ config, guardar }: { config: Config; guardar: (k: string, v: unknown) => Promise<void> }) {
  const [n, setN] = useState({ ...config.negocio });
  const [g, setG] = useState({ ...config.guia });
  const campos: [string, string][] = [['nombre', 'Nombre'], ['telefono', 'WhatsApp del negocio'], ['ciudad', 'Ciudad'], ['direccion', 'Dirección'], ['mapa', 'Enlace del mapa'], ['web', 'Página web'], ['instagram', 'Instagram'], ['horario', 'Horario'], ['ultimo_domicilio', 'Último domicilio sale a las'], ['horas_pago_antes', 'Horas mínimas de pago antes de la entrega']];
  return (
    <div className="tarjeta p-4 grid sm:grid-cols-2 gap-3 max-w-3xl">
      {campos.map(([k, t]) => <Campo key={k} etiqueta={t} clase={['direccion', 'mapa', 'horario'].includes(k) ? 'sm:col-span-2' : ''}><input className="campo" value={String(n[k] ?? '')} onChange={(e) => setN({ ...n, [k]: e.target.value })} /></Campo>)}
      <Campo etiqueta="Nota al pie de la guía de entrega" clase="sm:col-span-2"><input className="campo" value={g.nota} onChange={(e) => setG({ nota: e.target.value })} /></Campo>
      <button className="boton-primario sm:col-span-2" onClick={async () => { await guardar('negocio', n); await guardar('guia', g); }}>Guardar</button>
    </div>
  );
}

function Franjas({ config, guardar }: { config: Config; guardar: (k: string, v: unknown) => Promise<void> }) {
  const [f, setF] = useState(config.franjas.map((x) => ({ ...x })));
  const set = (i: number, k: string, v: string | number) => setF((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="tarjeta p-4 max-w-3xl space-y-3">
      <p className="text-sm text-tinta/60">Las franjas ordenan la agenda del día. La capacidad es cuántos pedidos caben sin sobrevender (0 = sin límite).</p>
      {f.map((x, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end">
          <Campo etiqueta="Clave" clase="col-span-3 sm:col-span-2"><input className="campo" value={x.clave} onChange={(e) => set(i, 'clave', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} /></Campo>
          <Campo etiqueta="Nombre" clase="col-span-9 sm:col-span-4"><input className="campo" value={x.nombre} onChange={(e) => set(i, 'nombre', e.target.value)} /></Campo>
          <Campo etiqueta="Desde" clase="col-span-4 sm:col-span-2"><input className="campo" type="time" value={x.desde} onChange={(e) => set(i, 'desde', e.target.value)} /></Campo>
          <Campo etiqueta="Hasta" clase="col-span-4 sm:col-span-2"><input className="campo" type="time" value={x.hasta} onChange={(e) => set(i, 'hasta', e.target.value)} /></Campo>
          <Campo etiqueta="Cap." clase="col-span-3 sm:col-span-1"><input className="campo" inputMode="numeric" value={x.capacidad} onChange={(e) => set(i, 'capacidad', Number(e.target.value) || 0)} /></Campo>
          <button className="boton-fantasma text-red-600 col-span-1 px-2" onClick={() => setF((l) => l.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="flex gap-2"><button className="boton-secundario" onClick={() => setF([...f, { clave: `franja${f.length + 1}`, nombre: 'Nueva franja', desde: '09:00', hasta: '12:00', capacidad: 0 }])}>+ Franja</button><button className="boton-primario" onClick={() => guardar('franjas', f)}>Guardar</button></div>
    </div>
  );
}

function Zonas() {
  const { avisar } = useToast();
  const [lista, setLista] = useState<Zona[]>([]);
  const [q, setQ] = useState('');
  const [nueva, setNueva] = useState({ zona: '', precio: '' });
  const cargar = () => api.zonas(true).then(setLista);
  useEffect(() => { cargar(); }, []);
  const editar = (z: Zona, d: Partial<{ zona: string; precio: number | null; activo: boolean }>) => api.editarZona(z.id, d).then(cargar).catch((e) => avisar(e.message, 'error'));
  const filtradas = lista.filter((z) => z.zona.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="tarjeta p-4 max-w-3xl space-y-3">
      <p className="text-sm text-tinta/60">{lista.length} zonas. Al elegir el barrio en un pedido, el domicilio se llena con esta tarifa. Sin tarifa = sin cobertura confirmada.</p>
      <div className="flex gap-2"><input className="campo" placeholder="Buscar zona…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="flex gap-2 items-end"><Campo etiqueta="Nueva zona" clase="flex-1"><input className="campo" value={nueva.zona} onChange={(e) => setNueva({ ...nueva, zona: e.target.value })} /></Campo><Campo etiqueta="Tarifa"><input className="campo w-28" inputMode="numeric" value={nueva.precio} onChange={(e) => setNueva({ ...nueva, precio: e.target.value })} /></Campo><button className="boton-primario" onClick={() => api.crearZona({ zona: nueva.zona, precio: nueva.precio ? Number(nueva.precio) : null }).then(() => { setNueva({ zona: '', precio: '' }); cargar(); }).catch((e) => avisar(e.message, 'error'))}>Agregar</button></div>
      <div className="divide-y divide-rosa-50 max-h-[60vh] overflow-y-auto">
        {filtradas.map((z) => (
          <div key={z.id} className={`flex items-center gap-2 py-1.5 text-sm ${!z.activo ? 'opacity-50' : ''}`}>
            <span className="flex-1">{z.zona}</span>
            <input className="campo w-28 py-1 text-right" inputMode="numeric" defaultValue={z.precio ?? ''} placeholder="sin tarifa" onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== z.precio) editar(z, { precio: v }); }} />
            <button className="text-xs cursor-pointer text-tinta/60 w-16" onClick={() => editar(z, { activo: !z.activo })}>{z.activo ? 'ocultar' : 'activar'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Domiciliarios() {
  const { avisar } = useToast();
  const [lista, setLista] = useState<Domiciliario[]>([]);
  const [nuevo, setNuevo] = useState({ nombre: '', telefono: '' });
  const cargar = () => api.domiciliarios(true).then(setLista);
  useEffect(() => { cargar(); }, []);
  return (
    <div className="tarjeta p-4 max-w-2xl space-y-3">
      <p className="text-sm text-tinta/60">Con el teléfono, la guía y la ruta del día se les mandan por WhatsApp con un botón.</p>
      {lista.map((d) => (
        <div key={d.id} className={`flex items-center gap-2 text-sm ${!d.activo ? 'opacity-50' : ''}`}>
          <input className="campo flex-1 py-1.5" defaultValue={d.nombre} onBlur={(e) => e.target.value !== d.nombre && api.editarDomiciliario(d.id, { nombre: e.target.value }).then(cargar)} />
          <input className="campo w-40 py-1.5" defaultValue={d.telefono || ''} placeholder="teléfono" onBlur={(e) => e.target.value !== (d.telefono || '') && api.editarDomiciliario(d.id, { telefono: e.target.value }).then(cargar)} />
          <button className="text-xs cursor-pointer text-tinta/60 w-16" onClick={() => api.editarDomiciliario(d.id, { activo: !d.activo }).then(cargar)}>{d.activo ? 'ocultar' : 'activar'}</button>
        </div>
      ))}
      <div className="flex gap-2 items-end border-t border-rosa-100 pt-3">
        <Campo etiqueta="Nombre" clase="flex-1"><input className="campo" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></Campo>
        <Campo etiqueta="Teléfono"><input className="campo w-40" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} /></Campo>
        <button className="boton-primario" onClick={() => api.crearDomiciliario(nuevo).then(() => { setNuevo({ nombre: '', telefono: '' }); cargar(); }).catch((e) => avisar(e.message, 'error'))}>Agregar</button>
      </div>
    </div>
  );
}

function MediosPago({ config, guardar }: { config: Config; guardar: (k: string, v: unknown) => Promise<void> }) {
  const [m, setM] = useState(config.medios_pago.map((x) => ({ ...x })));
  const set = (i: number, k: string, v: string | number) => setM((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="tarjeta p-4 max-w-3xl space-y-3">
      <p className="text-sm text-tinta/60">El recargo (%) se suma solo al total cuando el pedido se paga con ese medio (tarjeta y PayPal: 6 %).</p>
      {m.map((x, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end">
          <Campo etiqueta="Clave" clase="col-span-3 sm:col-span-2"><input className="campo" value={x.clave} onChange={(e) => set(i, 'clave', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} /></Campo>
          <Campo etiqueta="Nombre" clase="col-span-6 sm:col-span-3"><input className="campo" value={x.nombre} onChange={(e) => set(i, 'nombre', e.target.value)} /></Campo>
          <Campo etiqueta="% rec." clase="col-span-3 sm:col-span-1"><input className="campo" inputMode="numeric" value={x.recargo} onChange={(e) => set(i, 'recargo', Number(e.target.value) || 0)} /></Campo>
          <Campo etiqueta="Datos (cuenta, titular…)" clase="col-span-11 sm:col-span-5"><input className="campo" value={x.detalle || ''} onChange={(e) => set(i, 'detalle', e.target.value)} /></Campo>
          <button className="boton-fantasma text-red-600 col-span-1 px-2" onClick={() => setM((l) => l.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="flex gap-2"><button className="boton-secundario" onClick={() => setM([...m, { clave: `medio${m.length + 1}`, nombre: 'Nuevo', recargo: 0 }])}>+ Medio</button><button className="boton-primario" onClick={() => guardar('medios_pago', m)}>Guardar</button></div>
    </div>
  );
}

function Mensajes({ config, guardar }: { config: Config; guardar: (k: string, v: unknown) => Promise<void> }) {
  const [s, setS] = useState({ ...config.seguimientos, plantillas: { ...config.seguimientos.plantillas } });
  const [wa, setWa] = useState({ url: '', apikey: '', instancia: 'tatiramos', ...(config.whatsapp || {}) });
  const [estado, setEstado] = useState<string>('');
  const [prueba, setPrueba] = useState('');
  const { avisar } = useToast();
  useEffect(() => { api.whatsappEstado().then((e) => setEstado(e.estado)); }, []);
  const T = ({ k, t, ayuda }: { k: string; t: string; ayuda: string }) => (
    <Campo etiqueta={t} ayuda={ayuda}><textarea className="campo" rows={3} value={s.plantillas[k]} onChange={(e) => setS({ ...s, plantillas: { ...s.plantillas, [k]: e.target.value } })} /></Campo>
  );
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="tarjeta p-4 space-y-3">
        <h2 className="font-bold">Seguimientos automáticos</h2>
        <label className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer ${s.activo ? 'bg-green-50' : 'bg-amber-50'}`}><input type="checkbox" className="accent-rosa-500 size-5" checked={s.activo} onChange={(e) => setS({ ...s, activo: e.target.checked })} /><span className="text-sm"><b>{s.activo ? 'Encendidos' : 'Apagados'}</b> · {s.activo ? 'los mensajes salen solos desde el WhatsApp de la floristería' : 'se programan y se ven en Mensajes, pero no se envían'}</span></label>
        {([['confirmacion', 'Al confirmar el pedido'], ['entrega', 'Al entregar'], ['pago_pendiente', 'Alerta de pago pendiente'], ['recompra', 'Recordatorio en fechas especiales']] as const).map(([k, t]) => (
          <label key={k} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-rosa-500 size-4" checked={Boolean(s[k])} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /> {t}</label>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Alerta de pago: horas después de crear"><input className="campo" inputMode="numeric" value={s.pago_pendiente_horas} onChange={(e) => setS({ ...s, pago_pendiente_horas: Number(e.target.value) || 1 })} /></Campo>
          <Campo etiqueta="Recompra: días antes de la fecha"><input className="campo" inputMode="numeric" value={s.recompra_dias_antes} onChange={(e) => setS({ ...s, recompra_dias_antes: Number(e.target.value) || 1 })} /></Campo>
        </div>
        <T k="confirmacion" t="Mensaje al confirmar" ayuda="Variables: {nombre} {codigo} {fecha} {franja} {total} {recibe}" />
        <T k="entrega" t="Mensaje al entregar" ayuda="Variables: {nombre} {codigo}" />
        <T k="pago_pendiente" t="Alerta de pago pendiente" ayuda="Variables: {nombre} {codigo} {fecha} {pendiente}" />
        <T k="recompra" t="Recordatorio de fecha especial" ayuda="Variables: {nombre} {ocasion} {fecha}" />
        <button className="boton-primario w-full" onClick={() => guardar('seguimientos', s)}>Guardar mensajes</button>
      </div>
      <div className="tarjeta p-4 space-y-3">
        <h2 className="font-bold">Conexión con WhatsApp</h2>
        <p className="text-sm text-tinta/60">Los mensajes salen por la misma línea del agente de WhatsApp (Evolution API). Estado: <Insignia clase={estado === 'open' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{estado || '…'}</Insignia></p>
        <Campo etiqueta="URL de Evolution"><input className="campo" value={wa.url} onChange={(e) => setWa({ ...wa, url: e.target.value })} placeholder="http://127.0.0.1:3417" /></Campo>
        <Campo etiqueta="API key"><input className="campo" type="password" value={wa.apikey} onChange={(e) => setWa({ ...wa, apikey: e.target.value })} /></Campo>
        <Campo etiqueta="Instancia"><input className="campo" value={wa.instancia} onChange={(e) => setWa({ ...wa, instancia: e.target.value })} /></Campo>
        <button className="boton-secundario w-full" onClick={async () => { await guardar('whatsapp', wa); api.whatsappEstado().then((e) => setEstado(e.estado)); }}>Guardar conexión</button>
        <div className="flex gap-2 items-end border-t border-rosa-100 pt-3"><Campo etiqueta="Enviar prueba a" clase="flex-1"><input className="campo" value={prueba} onChange={(e) => setPrueba(e.target.value)} placeholder="300 123 4567" /></Campo><button className="boton-suave" onClick={() => api.whatsappPrueba(prueba, 'Prueba desde TatiPOS 🌸').then(() => avisar('Enviado')).catch((e) => avisar(e.message, 'error'))}>Probar</button></div>
      </div>
    </div>
  );
}

function Usuarios() {
  const { usuario } = useSesion();
  const { avisar } = useToast();
  const [lista, setLista] = useState<(Usuario & { activo: number })[]>([]);
  const [modal, setModal] = useState<null | Partial<Usuario & { clave: string; activo: number }>>(null);
  const [claveActual, setClaveActual] = useState({ actual: '', nueva: '' });
  const cargar = () => api.auth.usuarios().then(setLista);
  useEffect(() => { cargar(); }, []);
  const esNuevo = modal && !modal.id;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="tarjeta p-4 space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-bold">Usuarios</h2><button className="boton-primario py-1.5" onClick={() => setModal({ usuario: '', nombre: '', rol: 'trabajador', clave: '' })}>+ Usuario</button></div>
        <p className="text-sm text-tinta/60"><b>Administrador</b>: todo, incluidos reportes, caja y configuración. <b>Trabajador</b>: pedidos, producción, entregas, clientes y catálogo.</p>
        {lista.map((u) => (
          <div key={u.id} className={`flex items-center gap-3 text-sm ${!u.activo ? 'opacity-50' : ''}`}>
            <div className="flex-1"><b>{u.nombre}</b> <span className="text-tinta/50">@{u.usuario}</span></div>
            <Insignia clase={u.rol === 'admin' ? 'bg-rosa-100 text-rosa-700' : 'bg-sky-100 text-sky-800'}>{u.rol === 'admin' ? 'Admin' : 'Trabajador'}</Insignia>
            <button className="text-xs text-rosa-600 font-semibold cursor-pointer" onClick={() => setModal({ ...u, clave: '' })}>editar</button>
          </div>
        ))}
      </div>
      <div className="tarjeta p-4 space-y-3">
        <h2 className="font-bold">Mi clave</h2>
        <Campo etiqueta="Clave actual"><input className="campo" type="password" value={claveActual.actual} onChange={(e) => setClaveActual({ ...claveActual, actual: e.target.value })} /></Campo>
        <Campo etiqueta="Clave nueva"><input className="campo" type="password" value={claveActual.nueva} onChange={(e) => setClaveActual({ ...claveActual, nueva: e.target.value })} /></Campo>
        <button className="boton-secundario w-full" onClick={() => api.auth.cambiarClave(claveActual.actual, claveActual.nueva).then(() => { avisar('Clave cambiada'); setClaveActual({ actual: '', nueva: '' }); }).catch((e) => avisar(e.message, 'error'))}>Cambiar mi clave</button>
      </div>
      <Modal abierto={Boolean(modal)} cerrar={() => setModal(null)} titulo={esNuevo ? 'Nuevo usuario' : `Editar ${modal?.nombre}`}>
        {modal ? (
          <div className="space-y-3">
            {esNuevo ? <Campo etiqueta="Usuario (para entrar)"><input className="campo" value={modal.usuario || ''} onChange={(e) => setModal({ ...modal, usuario: e.target.value })} autoCapitalize="none" /></Campo> : null}
            <Campo etiqueta="Nombre"><input className="campo" value={modal.nombre || ''} onChange={(e) => setModal({ ...modal, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Rol"><select className="campo" value={modal.rol} onChange={(e) => setModal({ ...modal, rol: e.target.value as Usuario['rol'] })} disabled={modal.id === usuario?.id}><option value="admin">Administrador</option><option value="trabajador">Trabajador</option></select></Campo>
            <Campo etiqueta={esNuevo ? 'Clave' : 'Nueva clave (vacío = no cambiar)'}><input className="campo" type="password" value={modal.clave || ''} onChange={(e) => setModal({ ...modal, clave: e.target.value })} /></Campo>
            {!esNuevo && modal.id !== usuario?.id ? <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-rosa-500 size-4" checked={Boolean(modal.activo)} onChange={(e) => setModal({ ...modal, activo: e.target.checked ? 1 : 0 })} /> Activo (puede entrar)</label> : null}
            <button className="boton-primario w-full" onClick={() => (esNuevo ? api.auth.crearUsuario({ usuario: modal.usuario!, nombre: modal.nombre!, clave: modal.clave!, rol: modal.rol! }) : api.auth.editarUsuario(modal.id!, { nombre: modal.nombre, rol: modal.rol, activo: Boolean(modal.activo), clave: modal.clave || undefined })).then(() => { avisar('Guardado'); setModal(null); cargar(); }).catch((e) => avisar(e.message, 'error'))}>Guardar</button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Sistema({ config }: { config: Config; guardar: (k: string, v: unknown) => Promise<void> }) {
  const { avisar } = useToast();
  const { recargarConfig } = useSesion();
  const [respaldos, setRespaldos] = useState<{ archivo: string; bytes: number }[]>([]);
  const [verLlave, setVerLlave] = useState(false);
  useEffect(() => { api.respaldos().then(setRespaldos); }, []);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="tarjeta p-4 space-y-3">
        <h2 className="font-bold">Integración con el agente de WhatsApp</h2>
        <p className="text-sm text-tinta/60">Cuando el agente cierra una venta, crea el pedido aquí automáticamente (queda como <b>Nuevo</b> con la marca 🤖 para que el equipo lo confirme). Esta llave es la que se configura en el bot.</p>
        <div className="flex gap-2 items-center"><code className="campo text-xs flex-1 overflow-x-auto">{verLlave ? (config.integracion_bot?.apikey || '(sin llave)') : '••••••••••••••••'}</code><button className="boton-secundario py-1.5" onClick={() => setVerLlave(!verLlave)}>{verLlave ? 'Ocultar' : 'Ver'}</button></div>
        <button className="boton-suave" onClick={() => confirm('Al regenerar la llave hay que actualizarla en el bot. ¿Continuar?') && api.regenerarLlaveBot().then(() => { avisar('Llave nueva generada'); recargarConfig(); })}>Regenerar llave</button>
        <p className="text-xs text-tinta/50">Endpoint: <code>POST /api/integraciones/bot/pedido</code> con cabecera <code>x-api-key</code>.</p>
      </div>
      <div className="tarjeta p-4 space-y-3">
        <h2 className="font-bold">Respaldos</h2>
        <p className="text-sm text-tinta/60">Copia completa de la base de datos. Además se hace una copia automática cada noche.</p>
        <button className="boton-primario" onClick={() => api.respaldar().then((r) => { avisar(`Respaldo creado: ${r.archivo}`); api.respaldos().then(setRespaldos); })}>Hacer respaldo ahora</button>
        <ul className="text-xs text-tinta/60 space-y-0.5 max-h-40 overflow-y-auto">{respaldos.map((r) => <li key={r.archivo}>{r.archivo} · {Math.round(r.bytes / 1024)} KB</li>)}</ul>
        <p className="text-xs text-tinta/40 pt-2 border-t border-rosa-100">TatiPOS v1.0 · DT Growth Partners · {pesos(0).slice(0, 1)} COP · {telefonoBonito('573007189383')}</p>
      </div>
    </div>
  );
}
