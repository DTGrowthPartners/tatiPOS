import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Pedido } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, SelectorFecha, Insignia, useToast } from '../componentes/ui';
import { hoy, relativa } from '../lib/formato';
import { ESTADO, PAGO, type Estado } from '../lib/estados';

export default function Produccion() {
  const [sp, setSp] = useSearchParams();
  const fecha = sp.get('fecha') || hoy();
  const { config } = useSesion();
  const { avisar } = useToast();
  const [d, setD] = useState<Awaited<ReturnType<typeof api.produccion>> | null>(null);
  const cargar = () => api.produccion(fecha).then(setD);
  useEffect(() => { setD(null); cargar(); }, [fecha]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Cargando />;
  const franjaN = (c: string | null) => config?.franjas.find((f) => f.clave === c)?.nombre || '';

  async function mover(p: Pedido, estado: Estado) {
    try { await api.cambiarEstado(p.id, estado); await cargar(); avisar(`${p.codigo} → ${ESTADO[estado].nombre}`); } catch (e) { avisar((e as Error).message, 'error'); }
  }
  async function asignar(p: Pedido, preparador_id: number | null) {
    try { await api.asignar(p.id, { preparador_id }); await cargar(); } catch (e) { avisar((e as Error).message, 'error'); }
  }

  return (
    <div>
      <Encabezado titulo="Producción" sub={<>Qué se prepara, quién y para cuándo{d.atrasados ? <span className="text-red-600 font-semibold"> · {d.atrasados} de días anteriores sin cerrar</span> : null}</>} acciones={<SelectorFecha valor={fecha} onChange={(f) => setSp({ fecha: f })} />} />
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {d.columnas.map((c) => {
          const est = ESTADO[c.estado as Estado];
          return (
            <div key={c.estado} className="tarjeta p-3">
              <h2 className="font-bold text-sm flex items-center gap-2 mb-3"><span className={`size-2.5 rounded-full ${est.punto}`} />{est.nombre} <span className="text-tinta/40">{c.pedidos.length}</span></h2>
              <div className="space-y-2">
                {c.pedidos.map((p) => (
                  <div key={p.id} className={`rounded-xl border p-2.5 bg-white ${p.fecha_entrega < fecha ? 'border-red-300' : p.urgente ? 'border-red-200 bg-red-50/40' : 'border-rosa-100'}`}>
                    <Link to={`/pedidos/${p.id}`} className="block">
                      <div className="flex justify-between text-[11px]"><span className="font-mono font-bold text-rosa-600">{p.codigo}</span><span className={p.fecha_entrega < fecha ? 'text-red-600 font-bold' : 'text-tinta/60'}>{relativa(p.fecha_entrega)} {franjaN(p.franja)} {p.hora_entrega || ''}</span></div>
                      <p className="text-sm font-semibold mt-0.5">{p.resumen_items}</p>
                      {p.especificaciones ? <p className="text-xs text-amber-800 bg-amber-50 rounded px-1.5 py-0.5 mt-1">✨ {p.especificaciones}</p> : null}
                      <p className="text-xs text-tinta/60 mt-0.5">{p.ocasion === 'funebre' ? `🕊️ ${p.fallecido || ''}` : `para ${p.recibe_nombre || p.cliente_nombre || '—'}`}{p.tarjeta_mensaje ? ' · 💌' : ''}</p>
                    </Link>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {p.estado_pago !== 'pagado' ? <Insignia clase={PAGO[p.estado_pago].clase}>{PAGO[p.estado_pago].nombre}</Insignia> : null}
                      <select className="text-[11px] rounded-md border border-rosa-200 px-1 py-0.5 bg-white max-w-[110px]" value={p.preparador_id ?? ''} onChange={(e) => asignar(p, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">¿quién?</option>{d.preparadores.map((u) => <option key={u.id} value={u.id}>{u.nombre.split(' ')[0]}</option>)}
                      </select>
                      {est.siguiente && est.siguiente !== 'entregado' ? <button onClick={() => mover(p, est.siguiente!)} className="ml-auto text-[11px] font-bold text-white bg-rosa-500 rounded-md px-2 py-1 cursor-pointer hover:bg-rosa-600">{est.accion} →</button> : null}
                      {est.siguiente === 'entregado' ? <Link to={`/pedidos/${p.id}`} className="ml-auto text-[11px] font-bold text-rosa-600">Entregar en detalle →</Link> : null}
                    </div>
                  </div>
                ))}
                {!c.pedidos.length ? <p className="text-xs text-tinta/40 text-center py-4">—</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
