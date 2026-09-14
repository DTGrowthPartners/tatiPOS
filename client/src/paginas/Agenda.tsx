import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Pedido, type Franja } from '../api';
import { Cargando, Encabezado, SelectorFecha, Insignia } from '../componentes/ui';
import { pesos, hoy, fechaLarga } from '../lib/formato';
import { ESTADO, PAGO, type Estado } from '../lib/estados';

export default function Agenda() {
  const [sp, setSp] = useSearchParams();
  const fecha = sp.get('fecha') || hoy();
  const [d, setD] = useState<Awaited<ReturnType<typeof api.agenda>> | null>(null);
  useEffect(() => { setD(null); api.agenda(fecha).then(setD); }, [fecha]);
  if (!d) return <Cargando />;
  const capacidadTotal = d.franjas.reduce((s, f) => s + (f.capacidad || 0), 0);

  return (
    <div>
      <Encabezado titulo="Agenda de entregas" sub={<span className="inline-block first-letter:uppercase">{fechaLarga(fecha)} · {d.total} pedido{d.total === 1 ? '' : 's'}{capacidadTotal ? ` de ${capacidadTotal} de capacidad` : ''}</span>}
        acciones={<><SelectorFecha valor={fecha} onChange={(f) => setSp({ fecha: f })} /><Link to="/pedidos/nuevo" className="boton-primario">+ Pedido</Link></>} />
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {d.franjas.map((f) => <Columna key={f.clave} franja={f} pedidos={f.pedidos} />)}
      </div>
      {d.sinFranja.length ? (
        <div className="mt-4"><h2 className="font-bold text-sm mb-2 text-amber-700">⚠️ Sin franja asignada ({d.sinFranja.length})</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-2">{d.sinFranja.map((p) => <TarjetaPedido key={p.id} p={p} />)}</div></div>
      ) : null}
      {d.recogen.length ? <p className="mt-4 text-xs text-tinta/60">🏪 {d.recogen.length} de estos pedidos los recoge el cliente en tienda.</p> : null}
    </div>
  );
}

function Columna({ franja, pedidos }: { franja: Franja & { pedidos: Pedido[] }; pedidos: Pedido[] }) {
  const cap = franja.capacidad || 0;
  const pct = cap ? Math.min(100, Math.round(pedidos.length * 100 / cap)) : 0;
  const lleno = cap && pedidos.length >= cap;
  return (
    <div className={`tarjeta p-3 ${lleno ? 'border-red-300' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div><h2 className="font-bold text-sm">{franja.nombre}</h2><p className="text-[11px] text-tinta/50">{franja.desde} – {franja.hasta}</p></div>
        <span className={`text-sm font-extrabold ${lleno ? 'text-red-600' : 'text-tinta/70'}`}>{pedidos.length}{cap ? `/${cap}` : ''}</span>
      </div>
      {cap ? <div className="h-1.5 rounded-full bg-rosa-100 mb-3 overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-rosa-500'}`} style={{ width: `${pct}%` }} /></div> : null}
      <div className="space-y-2">
        {pedidos.length ? pedidos.map((p) => <TarjetaPedido key={p.id} p={p} />) : <p className="text-xs text-tinta/40 text-center py-4">Libre</p>}
      </div>
      <p className="text-[11px] text-tinta/50 mt-2 text-right">{pesos(pedidos.reduce((s, p) => s + p.total, 0))}</p>
    </div>
  );
}

export function TarjetaPedido({ p }: { p: Pedido }) {
  const est = ESTADO[p.estado as Estado];
  return (
    <Link to={`/pedidos/${p.id}`} className={`block rounded-xl border p-2.5 hover:border-rosa-400 bg-white ${p.urgente ? 'border-red-300 bg-red-50/40' : 'border-rosa-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-rosa-600">{p.codigo}{p.hora_entrega ? ` · ${p.hora_entrega}` : ''}</span>
        <span className={`size-2.5 rounded-full ${est.punto}`} title={est.nombre} />
      </div>
      <p className="text-sm font-semibold truncate mt-0.5">{p.recibe_nombre || p.cliente_nombre || 'Sin nombre'}</p>
      <p className="text-xs text-tinta/60 truncate">{p.resumen_items}</p>
      <p className="text-xs text-tinta/60 truncate">{p.tipo_entrega === 'recoge' ? '🏪 Recoge' : `📍 ${p.zona_nombre || 'sin zona'}`}{p.domiciliario_nombre ? ` · 🛵 ${p.domiciliario_nombre}` : ''}</p>
      <div className="flex gap-1 mt-1.5 flex-wrap">
        <Insignia clase={est.clase}>{est.nombre}</Insignia>
        {p.estado_pago !== 'pagado' ? <Insignia clase={PAGO[p.estado_pago].clase}>{PAGO[p.estado_pago].nombre}</Insignia> : null}
        {p.origen === 'bot' ? <Insignia clase="bg-emerald-100 text-emerald-800">🤖</Insignia> : null}
      </div>
    </Link>
  );
}
