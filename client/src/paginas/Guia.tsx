import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Pedido } from '../api';
import { useSesion } from '../App';
import { Cargando } from '../componentes/ui';
import { pesos, fechaLarga, telefonoBonito, enlaceWa } from '../lib/formato';

// Guía de entrega: se genera sola desde el pedido. Sirve impresa, como PDF
// (imprimir → guardar) o mandada al domiciliario por WhatsApp con el botón.
export default function Guia() {
  const { id } = useParams();
  const { config } = useSesion();
  const [p, setP] = useState<Pedido | null>(null);
  useEffect(() => { api.pedido(Number(id)).then(setP); }, [id]);
  if (!p || !config) return <Cargando />;
  const franja = config.franjas.find((f) => f.clave === p.franja);
  const pendiente = Math.max(0, p.total - p.pagado);
  const lineas = [
    `🌸 *GUÍA DE ENTREGA ${p.codigo}* · Floristería Tati Ramos`,
    `📅 ${fechaLarga(p.fecha_entrega)}${franja ? ` · ${franja.nombre} ${franja.desde}–${franja.hasta}` : ''}${p.hora_entrega ? ` · ${p.hora_entrega}` : ''}`,
    `📦 ${p.items?.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}`,
    p.ocasion === 'funebre' ? `🕊️ ${p.fallecido || ''} · ${[p.funeraria, p.sala && `sala ${p.sala}`].filter(Boolean).join(' · ')}` : `👤 Recibe: ${p.recibe_nombre || '—'} · 📞 ${telefonoBonito(p.recibe_telefono) || '—'}`,
    `📍 ${p.zona_nombre || ''} · ${p.direccion || ''}${p.punto_referencia ? ` (${p.punto_referencia})` : ''}`,
    p.tarjeta_para || p.tarjeta_de ? `💌 Tarjeta: Para ${p.tarjeta_para || '—'} · De ${p.tarjeta_de || '—'}` : '',
    pendiente > 0 ? `⚠️ PENDIENTE DE PAGO: ${pesos(pendiente)} (NO se entrega sin pago)` : `✅ Pagado`,
    p.especificaciones ? `✨ ${p.especificaciones}` : '',
    `☎️ Cliente: ${telefonoBonito(p.cliente_telefono)}`,
  ].filter(Boolean).join('\n');

  return (
    <div className="min-h-dvh bg-white p-5 max-w-lg mx-auto text-tinta">
      <div className="flex items-center justify-between mb-4 no-imprimir">
        <Link to={`/pedidos/${p.id}`} className="boton-fantasma">← Volver</Link>
        <div className="flex gap-2">
          {p.domiciliario_telefono ? <a href={enlaceWa(p.domiciliario_telefono, lineas)} target="_blank" rel="noreferrer" className="boton-suave">WhatsApp al domiciliario</a> : <a href={enlaceWa('', lineas)} target="_blank" rel="noreferrer" className="boton-suave">Compartir por WhatsApp</a>}
          <button onClick={() => window.print()} className="boton-primario">Imprimir / PDF</button>
        </div>
      </div>
      <div className="tarjeta p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-rosa-100 pb-3">
          <img src="/logo.svg" alt="" className="h-12" />
          <div className="text-right"><p className="text-[10px] uppercase tracking-widest text-tinta/50">Guía de entrega</p><p className="font-mono text-2xl font-extrabold text-rosa-600">{p.codigo}</p></div>
        </div>
        <div className="text-center bg-rosa-50 rounded-xl py-2">
          <p className="font-bold capitalize">{fechaLarga(p.fecha_entrega)}</p>
          <p className="text-sm">{franja ? `${franja.nombre} · ${franja.desde} a ${franja.hasta}` : ''}{p.hora_entrega ? ` · ${p.hora_entrega}` : ''}{p.urgente ? ' · ⚠️ URGENTE' : ''}</p>
        </div>
        <F t="Arreglo" v={<ul className="list-disc pl-5">{p.items?.map((i) => <li key={i.id}>{i.cantidad} × {i.nombre}{i.nota ? ` — ${i.nota}` : ''}</li>)}</ul>} />
        {p.especificaciones ? <F t="Especificaciones" v={p.especificaciones} /> : null}
        {p.ocasion === 'funebre' ? (<><F t="Fallecido" v={p.fallecido} /><F t="Funeraria / sala" v={[p.funeraria, p.sala && `sala ${p.sala}`].filter(Boolean).join(' · ')} /></>) : (<>
          <F t="Recibe" v={<span className="text-lg font-bold">{p.recibe_nombre || '—'}</span>} /><F t="Teléfono de quien recibe" v={<span className="text-lg">{telefonoBonito(p.recibe_telefono) || '—'}</span>} />
        </>)}
        {p.tipo_entrega === 'domicilio' ? (<><F t="Zona" v={p.zona_nombre} /><F t="Dirección" v={<span className="text-lg">{p.direccion}</span>} /><F t="Referencia" v={p.punto_referencia} /></>) : <F t="Entrega" v="Recoge en tienda" />}
        <F t="Tarjeta" v={(p.tarjeta_para || p.tarjeta_de) ? `Para: ${p.tarjeta_para || '—'} · De: ${p.tarjeta_de || '—'}` : 'Sin tarjeta'} />
        <div className={`rounded-xl p-3 text-center font-bold ${pendiente > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700'}`}>
          {pendiente > 0 ? `PENDIENTE DE PAGO: ${pesos(pendiente)} — no se entrega sin pago` : `PAGADO · ${pesos(p.total)}`}
        </div>
        <F t="Domiciliario" v={p.domiciliario_nombre || '________________'} />
        <F t="Cliente" v={`${p.cliente_nombre || ''} · ${telefonoBonito(p.cliente_telefono)}`} />
        <p className="text-xs text-tinta/60 border-t border-rosa-100 pt-3">{config.guia.nota}</p>
        <div className="grid grid-cols-2 gap-6 pt-6 text-xs text-center text-tinta/60">
          <div className="border-t border-tinta/30 pt-1">Firma de quien recibe</div><div className="border-t border-tinta/30 pt-1">Hora de entrega</div>
        </div>
      </div>
    </div>
  );
}
function F({ t, v }: { t: string; v: React.ReactNode }) {
  if (!v) return null;
  return <div><p className="text-[10px] uppercase tracking-wide text-tinta/50 font-semibold">{t}</p><div className="font-medium">{v}</div></div>;
}
