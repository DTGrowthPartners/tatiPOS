import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { api, type Pedido } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, Insignia, Vacio } from '../componentes/ui';
import { pesos, relativa, telefonoBonito, hoy, sumarDias } from '../lib/formato';
import { ESTADO, PAGO, ESTADOS, type Estado } from '../lib/estados';

export default function Pedidos() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { config } = useSesion();
  const [lista, setLista] = useState<Pedido[] | null>(null);
  const [q, setQ] = useState(sp.get('q') || '');
  const filtro = { fecha: sp.get('fecha') || '', desde: sp.get('desde') || '', hasta: sp.get('hasta') || '', estado: sp.get('estado') || '', pago: sp.get('pago') || '', q: sp.get('q') || '' };
  const rango = sp.get('rango') || (filtro.fecha || filtro.desde ? '' : 'activos');

  useEffect(() => {
    setLista(null);
    const f: Record<string, string> = { ...filtro };
    if (rango === 'activos') { f.estado = f.estado || 'nuevo,confirmado,preparacion,listo,en_ruta'; }
    if (rango === 'hoy') f.fecha = hoy();
    if (rango === 'semana') { f.desde = hoy(); f.hasta = sumarDias(hoy(), 6); }
    if (rango === 'atrasados') { f.hasta = sumarDias(hoy(), -1); f.estado = 'nuevo,confirmado,preparacion,listo,en_ruta'; }
    api.pedidos(f).then(setLista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const poner = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k === 'rango') { n.delete('fecha'); n.delete('desde'); n.delete('hasta'); } setSp(n); };
  const nombreFranja = (c: string | null) => config?.franjas.find((f) => f.clave === c)?.nombre || '';

  return (
    <div>
      <Encabezado titulo="Pedidos" sub={lista ? `${lista.length} pedido${lista.length === 1 ? '' : 's'}` : ''} acciones={<Link to="/pedidos/nuevo" className="boton-primario"><Plus className="size-4" /> Nuevo pedido</Link>} />
      <div className="flex flex-wrap gap-2 mb-3">
        {[['activos', 'Activos'], ['hoy', 'Hoy'], ['semana', 'Esta semana'], ['atrasados', 'Atrasados'], ['todos', 'Todos']].map(([k, t]) => (
          <button key={k} onClick={() => poner('rango', k)} className={`insignia py-1.5 px-3 text-sm cursor-pointer ${rango === k ? 'bg-rosa-500 text-white' : 'bg-white border border-rosa-200 text-tinta/70'}`}>{t}</button>
        ))}
        {filtro.fecha ? <span className="insignia bg-rosa-100 text-rosa-700 py-1.5 px-3 text-sm">{relativa(filtro.fecha)} <button className="cursor-pointer" onClick={() => poner('fecha', '')}>✕</button></span> : null}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <form className="relative flex-1 min-w-[200px]" onSubmit={(e) => { e.preventDefault(); poner('q', q.trim()); }}>
          <Search className="size-4 absolute left-3 top-3 text-tinta/40" />
          <input className="campo pl-9" placeholder="Código, cliente, teléfono, dirección, producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select className="campo w-auto" value={filtro.estado.includes(',') ? '' : filtro.estado} onChange={(e) => poner('estado', e.target.value)}>
          <option value="">Estado: todos</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO[e].nombre}</option>)}
        </select>
        <select className="campo w-auto" value={filtro.pago} onChange={(e) => poner('pago', e.target.value)}>
          <option value="">Pago: todos</option>
          <option value="pendiente">Sin pago</option><option value="abono">Con abono</option><option value="pagado">Pagados</option>
        </select>
      </div>

      {!lista ? <Cargando /> : lista.length === 0 ? <Vacio texto="No hay pedidos con ese filtro" /> : (
        <div className="space-y-2">
          {lista.map((p) => (
            <div key={p.id} onClick={() => nav(`/pedidos/${p.id}`)} className="tarjeta p-3.5 flex gap-3 cursor-pointer hover:border-rosa-300 transition-colors">
              <div className={`w-1.5 rounded-full shrink-0 ${ESTADO[p.estado as Estado]?.punto || 'bg-gray-300'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-xs font-bold text-rosa-600">{p.codigo}</span>
                  <span className="font-semibold text-sm truncate">{p.cliente_nombre || 'Sin nombre'}</span>
                  {p.urgente ? <Insignia clase="bg-red-100 text-red-700">Urgente</Insignia> : null}
                  {p.origen === 'bot' ? <Insignia clase="bg-emerald-100 text-emerald-800">🤖</Insignia> : null}
                </div>
                <p className="text-xs text-tinta/60 truncate mt-0.5">{p.resumen_items}</p>
                <p className="text-xs text-tinta/60 mt-0.5">
                  <b className={p.fecha_entrega < hoy() && !['entregado', 'cancelado'].includes(p.estado) ? 'text-red-600' : ''}>{relativa(p.fecha_entrega)}</b>
                  {p.franja ? ` · ${nombreFranja(p.franja)}` : ''}{p.hora_entrega ? ` ${p.hora_entrega}` : ''} · {p.tipo_entrega === 'recoge' ? 'Recoge en tienda' : (p.zona_nombre || 'sin zona')}
                  {p.recibe_nombre ? ` · para ${p.recibe_nombre}` : ''}{p.cliente_telefono ? ` · ${telefonoBonito(p.cliente_telefono)}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="font-bold text-sm">{pesos(p.total)}</p>
                <div><Insignia clase={ESTADO[p.estado as Estado]?.clase}>{ESTADO[p.estado as Estado]?.nombre}</Insignia></div>
                <div><Insignia clase={PAGO[p.estado_pago].clase}>{PAGO[p.estado_pago].nombre}</Insignia></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
