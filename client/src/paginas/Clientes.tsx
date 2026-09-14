import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { api, type Cliente, type Zona } from '../api';
import { Cargando, Encabezado, Vacio, Modal, Campo, CampoZona, useToast } from '../componentes/ui';
import { pesos, telefonoBonito, relativa, iniciales } from '../lib/formato';

export default function Clientes() {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Cliente[] | null>(null);
  const [nuevo, setNuevo] = useState<null | { nombre: string; telefono: string; email: string; notas: string; direccion: string; punto_referencia: string; zona_id: string; zona_nombre: string }>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  useEffect(() => { api.zonas().then(setZonas); }, []);
  const nav = useNavigate();
  const { avisar } = useToast();
  useEffect(() => { const t = setTimeout(() => api.clientes(q).then(setLista), 250); return () => clearTimeout(t); }, [q]);
  async function crear() {
    if (!nuevo) return;
    try { const c = await api.crearCliente({ ...nuevo, zona_id: nuevo.zona_id ? Number(nuevo.zona_id) : null }); avisar('Cliente creado'); setNuevo(null); nav(`/clientes/${c.id}`); } catch (e) { avisar((e as Error).message, 'error'); }
  }
  return (
    <div>
      <Encabezado titulo="Clientes" sub="Se llena solo con cada pedido: historial, valor y fechas importantes" acciones={<button onClick={() => setNuevo({ nombre: '', telefono: '', email: '', notas: '', direccion: '', punto_referencia: '', zona_id: '', zona_nombre: '' })} className="boton-primario"><Plus className="size-4" /> Cliente</button>} />
      <Modal abierto={Boolean(nuevo)} cerrar={() => setNuevo(null)} titulo="Nuevo cliente">
        {nuevo ? (
          <div className="space-y-3">
            <Campo etiqueta="Nombre"><input className="campo" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} autoFocus /></Campo>
            <Campo etiqueta="Teléfono (WhatsApp)"><input className="campo" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} /></Campo>
            <Campo etiqueta="Correo (opcional)"><input className="campo" type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} /></Campo>
            <div className="rounded-xl border border-rosa-100 bg-rosa-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-tinta/70">📍 Dirección predeterminada para domicilios <span className="font-normal text-tinta/50">(se precarga en cada pedido; se puede cambiar ahí)</span></p>
              <Campo etiqueta="Barrio / zona"><CampoZona zonas={zonas} valor={nuevo.zona_nombre} zonaId={nuevo.zona_id} onChange={(z) => setNuevo({ ...nuevo, zona_id: z.zona_id, zona_nombre: z.zona_nombre })} /></Campo>
              <Campo etiqueta="Dirección"><input className="campo" value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} /></Campo>
              <Campo etiqueta="Punto de referencia"><input className="campo" value={nuevo.punto_referencia} onChange={(e) => setNuevo({ ...nuevo, punto_referencia: e.target.value })} /></Campo>
            </div>
            <Campo etiqueta="Notas"><textarea className="campo" rows={2} value={nuevo.notas} onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })} /></Campo>
            <button onClick={crear} className="boton-primario w-full py-3">Guardar cliente</button>
          </div>
        ) : null}
      </Modal>
      <div className="relative mb-4"><Search className="size-4 absolute left-3 top-3 text-tinta/40" /><input className="campo pl-9" placeholder="Nombre, teléfono o correo" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!lista ? <Cargando /> : !lista.length ? <Vacio texto="Todavía no hay clientes" /> : (
        <div className="tarjeta divide-y divide-rosa-50">
          {lista.map((c) => (
            <Link key={c.id} to={`/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-rosa-50">
              <div className="size-10 rounded-full bg-rosa-100 text-rosa-700 font-bold flex items-center justify-center text-sm shrink-0">{iniciales(c.nombre || c.telefono)}</div>
              <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{c.nombre || 'Sin nombre'}</p><p className="text-xs text-tinta/60">{telefonoBonito(c.telefono)}{c.ultimo_pedido ? ` · último ${relativa(c.ultimo_pedido)}` : ''}</p></div>
              <div className="text-right"><p className="font-bold text-sm">{pesos(c.valor)}</p><p className="text-xs text-tinta/50">{c.pedidos as number} pedido{(c.pedidos as number) === 1 ? '' : 's'}</p></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
