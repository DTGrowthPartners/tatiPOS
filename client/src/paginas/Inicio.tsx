import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Dashboard } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, SelectorFecha, Stat, Insignia } from '../componentes/ui';
import { pesos, hoy, fechaLarga, relativa, enlaceWa } from '../lib/formato';
import { ESTADO, type Estado } from '../lib/estados';

export default function Inicio() {
  const { usuario, config, esAdmin } = useSesion();
  const [fecha, setFecha] = useState(hoy());
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => { setD(null); api.dashboard(fecha).then(setD); }, [fecha]);
  if (!d) return <Cargando />;
  const saludo = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';
  const orden: Estado[] = ['nuevo', 'confirmado', 'preparacion', 'listo', 'en_ruta', 'entregado'];
  const totalDia = orden.reduce((s, e) => s + (d.porEstado[e]?.n || 0), 0);
  const nombreFranja = (c: string | null) => config?.franjas.find((f) => f.clave === c)?.nombre || '';

  return (
    <div className="space-y-5">
      <Encabezado titulo={`${saludo}, ${usuario?.nombre?.split(' ')[0]} 🌸`} sub={<span className="inline-block first-letter:uppercase">{fechaLarga(fecha)}</span>} acciones={<SelectorFecha valor={fecha} onChange={setFecha} />} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat etiqueta="Pedidos del día" valor={totalDia} sub={`${d.porEstado.entregado?.n || 0} entregados · ${d.porEstado.en_ruta?.n || 0} en ruta`} />
        <Stat etiqueta="Ventas del día" valor={pesos(d.ventasDia.total)} sub={`${pesos(d.ventasDia.pagado)} ya pagado`} />
        <Stat etiqueta="Cobrado hoy" valor={pesos(d.cobradoHoy.reduce((s, x) => s + x.total, 0))} sub={d.cobradoHoy.map((x) => `${x.medio} ${pesos(x.total)}`).join(' · ') || 'sin pagos'} />
        {esAdmin ? <Stat etiqueta="Este mes" valor={pesos(d.mes.total)} sub={`${d.mes.n} pedidos · semana ${pesos(d.semana.total)}`} /> : <Stat etiqueta="Pendientes de pago" valor={d.pendientesPago.length} sub="con entrega hoy o mañana" />}
      </div>

      {/* Embudo del día */}
      <div className="tarjeta p-4">
        <div className="flex flex-wrap gap-2">
          {orden.map((e) => (
            <Link key={e} to={`/pedidos?fecha=${fecha}&estado=${e}`} className={`insignia ${ESTADO[e].clase} py-1.5 px-3 text-sm`}>
              <span className={`size-2 rounded-full ${ESTADO[e].punto}`} /> {ESTADO[e].nombre}: <b>{d.porEstado[e]?.n || 0}</b>
            </Link>
          ))}
          {d.porEstado.cancelado?.n ? <span className="insignia bg-gray-100 text-gray-600 py-1.5 px-3 text-sm">Cancelados: {d.porEstado.cancelado.n}</span> : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel titulo="Por confirmar" n={d.nuevosSinConfirmar.length} vacio="Nada nuevo por confirmar" enlace="/pedidos?estado=nuevo">
          {d.nuevosSinConfirmar.map((p) => (
            <Fila key={p.id} a={`/pedidos/${p.id}`} titulo={`${p.codigo} · ${p.cliente_nombre || 'Sin nombre'}`} sub={`${relativa(p.fecha_entrega)} · ${p.resumen_items || ''}`} derecha={<>{p.origen === 'bot' ? <Insignia clase="bg-emerald-100 text-emerald-800">🤖 WhatsApp</Insignia> : null}<b>{pesos(p.total)}</b></>} />
          ))}
        </Panel>
        <Panel titulo="Pendientes de pago" n={d.pendientesPago.length} vacio="Todo lo de hoy y mañana está pago" enlace="/pedidos?pago=pendiente">
          {d.pendientesPago.map((p) => (
            <Fila key={p.id} a={`/pedidos/${p.id}`} titulo={`${p.codigo} · ${p.cliente_nombre || 'Sin nombre'}`} sub={`${relativa(p.fecha_entrega)} ${nombreFranja(p.franja)} · ${p.resumen_items || ''}`}
              derecha={<div className="text-right"><b className="text-red-600">{pesos(p.total - p.pagado)}</b><div className="text-[11px] text-tinta/50">de {pesos(p.total)}</div></div>} />
          ))}
        </Panel>
        <Panel titulo="En ruta ahora" n={d.enRuta.length} vacio="Ningún domiciliario en ruta" enlace="/entregas">
          {d.enRuta.map((p) => (
            <Fila key={p.id} a={`/pedidos/${p.id}`} titulo={`${p.codigo} · ${p.recibe_nombre || ''}`} sub={`${p.zona_nombre || ''} · ${p.domiciliario_nombre || 'sin domiciliario'} · salió ${p.hora_salida || ''}`} />
          ))}
        </Panel>
        <Panel titulo="Próximos días" n={d.proximos.reduce((s, x) => s + x.n, 0)} vacio="Sin pedidos agendados para los próximos 7 días" enlace="/agenda">
          {d.proximos.map((x) => (
            <Fila key={x.fecha_entrega} a={`/agenda?fecha=${x.fecha_entrega}`} titulo={relativa(x.fecha_entrega)} sub={`${x.n} pedido${x.n === 1 ? '' : 's'}`} derecha={<b>{pesos(x.total)}</b>} />
          ))}
        </Panel>
        {d.fechasProximas.length ? (
          <Panel titulo="Fechas especiales que se acercan" n={d.fechasProximas.length} vacio="" enlace="/clientes">
            {d.fechasProximas.map((f) => (
              <Fila key={f.id} a={`/clientes/${f.cliente_id}`} titulo={`${f.cliente_nombre || f.telefono} · ${f.descripcion || f.tipo}`} sub={`el ${f.dia_mes.split('-').reverse().join('/')}`}
                derecha={f.telefono ? <a href={enlaceWa(f.telefono)} target="_blank" rel="noreferrer" className="boton-suave py-1 px-2 text-xs" onClick={(e) => e.stopPropagation()}>WhatsApp</a> : null} />
            ))}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ titulo, n, vacio, enlace, children }: { titulo: string; n: number; vacio: string; enlace: string; children: React.ReactNode }) {
  return (
    <div className="tarjeta">
      <div className="px-4 py-3 border-b border-rosa-100 flex items-center justify-between">
        <h2 className="font-bold text-sm">{titulo} <span className="text-rosa-500">{n}</span></h2>
        <Link to={enlace} className="text-xs font-semibold text-rosa-600">Ver todo</Link>
      </div>
      <div className="divide-y divide-rosa-50">{n === 0 ? <p className="px-4 py-6 text-sm text-tinta/50 text-center">{vacio}</p> : children}</div>
    </div>
  );
}
function Fila({ a, titulo, sub, derecha }: { a: string; titulo: string; sub?: string; derecha?: React.ReactNode }) {
  return (
    <Link to={a} className="flex items-center gap-3 px-4 py-2.5 hover:bg-rosa-50">
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{titulo}</p>{sub ? <p className="text-xs text-tinta/60 truncate">{sub}</p> : null}</div>
      {derecha ? <div className="shrink-0 flex items-center gap-2 text-sm">{derecha}</div> : null}
    </Link>
  );
}
