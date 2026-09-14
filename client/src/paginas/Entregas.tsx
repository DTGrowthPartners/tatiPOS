import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, Printer } from 'lucide-react';
import { api, type Pedido } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, SelectorFecha, Insignia, useToast } from '../componentes/ui';
import { hoy, pesos, telefonoBonito, enlaceWa } from '../lib/formato';
import { ESTADO, PAGO, type Estado } from '../lib/estados';

export default function Entregas() {
  const [sp, setSp] = useSearchParams();
  const fecha = sp.get('fecha') || hoy();
  const { config, esAdmin } = useSesion();
  const { avisar } = useToast();
  const [d, setD] = useState<Awaited<ReturnType<typeof api.entregas>> | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const pedidoFoto = useRef<Pedido | null>(null);
  const cargar = () => api.entregas(fecha).then(setD);
  useEffect(() => { setD(null); cargar(); }, [fecha]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Cargando />;
  const franjaN = (c: string | null) => config?.franjas.find((f) => f.clave === c)?.nombre || '';

  async function asignar(p: Pedido, domiciliario_id: number | null) {
    try { await api.asignar(p.id, { domiciliario_id }); await cargar(); } catch (e) { avisar((e as Error).message, 'error'); }
  }
  async function estado(p: Pedido, e: Estado) {
    try { await api.cambiarEstado(p.id, e); await cargar(); avisar(`${p.codigo}: ${ESTADO[e].nombre}`); } catch (err) { avisar((err as Error).message, 'error'); }
  }
  async function conFoto(f: File) {
    const p = pedidoFoto.current; if (!p) return;
    setSubiendo(p.id);
    try { await api.evidencia(p.id, f, true); await cargar(); avisar(`${p.codigo} entregado con foto`); } catch (e) { avisar((e as Error).message, 'error'); } finally { setSubiendo(null); }
  }
  const pendientes = d.pedidos.filter((p) => p.estado !== 'entregado');
  const grupos = [...d.porDomiciliario.map((x) => ({ titulo: `🛵 ${x.nombre}`, tel: x.telefono, pedidos: x.pedidos })), { titulo: '❔ Sin domiciliario', tel: null, pedidos: d.sinAsignar }].filter((g) => g.pedidos.length);
  const rutaTexto = (peds: Pedido[]) => peds.filter((p) => p.estado !== 'entregado').map((p, i) => `${i + 1}. ${p.codigo} · ${p.recibe_nombre || ''} · ${p.zona_nombre || ''} · ${p.direccion || ''} · 📞 ${telefonoBonito(p.recibe_telefono)}${p.total > p.pagado ? ` · ⚠️ cobrar ${pesos(p.total - p.pagado)}` : ''}`).join('\n');

  return (
    <div>
      <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) conFoto(f); e.target.value = ''; }} />
      <Encabezado titulo="Entregas del día" sub={`${pendientes.length} por entregar · ${d.pedidos.length - pendientes.length} entregados`} acciones={<><SelectorFecha valor={fecha} onChange={(f) => setSp({ fecha: f })} />{esAdmin ? <Link to="/configuracion?tab=domiciliarios" className="boton-secundario">Domiciliarios</Link> : null}</>} />
      {!d.pedidos.length ? <p className="text-sm text-tinta/50 text-center py-10">Sin domicilios para este día 🌸</p> : null}
      <div className="space-y-4">
        {grupos.map((g) => (
          <section key={g.titulo} className="tarjeta p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm">{g.titulo} <span className="text-tinta/40">{g.pedidos.length}</span></h2>
              {g.pedidos.some((p) => p.estado !== 'entregado') ? <a href={enlaceWa(g.tel || '', `🌸 Ruta ${fecha} · Floristería Tati Ramos\n${rutaTexto(g.pedidos)}`)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-rosa-600">Mandar ruta por WhatsApp</a> : null}
            </div>
            <div className="space-y-2">
              {g.pedidos.map((p) => {
                const est = ESTADO[p.estado as Estado];
                return (
                  <div key={p.id} className={`rounded-xl border p-3 bg-white ${p.estado === 'entregado' ? 'opacity-60' : p.urgente ? 'border-red-200' : 'border-rosa-100'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/pedidos/${p.id}`} className="font-mono text-xs font-bold text-rosa-600">{p.codigo}</Link>
                      <Insignia clase={est.clase}>{est.nombre}</Insignia>
                      {p.estado_pago !== 'pagado' ? <Insignia clase={PAGO[p.estado_pago].clase}>Cobrar {pesos(p.total - p.pagado)}</Insignia> : null}
                      <span className="text-xs text-tinta/60 ml-auto">{franjaN(p.franja)} {p.hora_entrega || ''}</span>
                    </div>
                    <p className="text-sm font-semibold mt-1">{p.recibe_nombre || p.cliente_nombre} · <a className="text-rosa-600" href={`tel:${p.recibe_telefono || p.cliente_telefono}`}>{telefonoBonito(p.recibe_telefono || p.cliente_telefono)}</a></p>
                    <p className="text-sm">{p.zona_nombre} · {p.direccion}{p.punto_referencia ? ` (${p.punto_referencia})` : ''}</p>
                    <p className="text-xs text-tinta/60">{p.resumen_items}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <select className="text-xs rounded-md border border-rosa-200 px-1.5 py-1 bg-white" value={p.domiciliario_id ?? ''} onChange={(e) => asignar(p, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">Domiciliario…</option>{d.porDomiciliario.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                      </select>
                      <Link to={`/pedidos/${p.id}/guia`} className="boton-secundario py-1 px-2 text-xs"><Printer className="size-3.5" /> Guía</Link>
                      {p.estado === 'listo' || p.estado === 'preparacion' || p.estado === 'confirmado' ? <button onClick={() => estado(p, 'en_ruta')} className="boton-suave py-1 px-2 text-xs">Salió →</button> : null}
                      {p.estado === 'en_ruta' ? <button disabled={subiendo === p.id} onClick={() => { pedidoFoto.current = p; fotoRef.current?.click(); }} className="boton-primario py-1 px-2.5 text-xs"><Camera className="size-3.5" /> {subiendo === p.id ? 'Subiendo…' : 'Entregado + foto'}</button> : null}
                      {p.estado === 'en_ruta' ? <button onClick={() => estado(p, 'entregado')} className="boton-fantasma py-1 px-2 text-xs">sin foto</button> : null}
                      {p.estado === 'entregado' && p.evidencia_foto ? <a href={`/uploads/${p.evidencia_foto}`} target="_blank" rel="noreferrer" className="text-xs text-rosa-600 font-semibold">📷 foto</a> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
