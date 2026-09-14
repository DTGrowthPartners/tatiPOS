import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Cliente, type Pedido } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, Insignia, Campo, Stat, useToast } from '../componentes/ui';
import { pesos, telefonoBonito, relativa, enlaceWa } from '../lib/formato';
import { ESTADO, type Estado } from '../lib/estados';

export default function ClienteDetalle() {
  const { id } = useParams();
  const { config } = useSesion();
  const { avisar } = useToast();
  const [c, setC] = useState<(Cliente & { pedidos: Pedido[] }) | null>(null);
  const [edit, setEdit] = useState({ nombre: '', email: '', notas: '' });
  const [fecha, setFecha] = useState({ tipo: 'cumpleanos', dia: '', mes: '', descripcion: '' });
  const cargar = () => api.cliente(Number(id)).then((x) => { setC(x); setEdit({ nombre: x.nombre || '', email: x.email || '', notas: x.notas || '' }); });
  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <Cargando />;
  const pedidos = c.pedidos;
  const ocasionN = (k: string) => config?.ocasiones.find((o) => o.clave === k)?.nombre || k;

  return (
    <div className="max-w-4xl space-y-4">
      <Encabezado titulo={c.nombre || 'Sin nombre'} sub={telefonoBonito(c.telefono)} acciones={<>
        {c.telefono ? <a href={enlaceWa(c.telefono)} target="_blank" rel="noreferrer" className="boton-suave">WhatsApp</a> : null}
        <Link to={`/pedidos/nuevo`} state={{ cliente: c }} className="boton-primario">+ Pedido</Link>
      </>} />
      <div className="grid grid-cols-3 gap-3">
        <Stat etiqueta="Pedidos" valor={pedidos.length} />
        <Stat etiqueta="Valor acumulado" valor={pesos(c.valor)} />
        <Stat etiqueta="Cliente desde" valor={c.creado_en.slice(0, 10) === pedidos[pedidos.length - 1]?.fecha_entrega ? relativa(c.creado_en.slice(0, 10)) : relativa(pedidos[pedidos.length - 1]?.fecha_entrega || c.creado_en.slice(0, 10))} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="tarjeta p-4 space-y-3">
          <h2 className="font-bold text-sm">Datos</h2>
          <Campo etiqueta="Nombre"><input className="campo" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
          <Campo etiqueta="Correo"><input className="campo" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Campo>
          <Campo etiqueta="Notas"><textarea className="campo" rows={3} value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} placeholder="Preferencias, alergias, cómo le gusta la tarjeta…" /></Campo>
          <button onClick={() => api.editarCliente(c.id, edit).then(() => { avisar('Guardado'); cargar(); }).catch((e) => avisar(e.message, 'error'))} className="boton-secundario w-full">Guardar</button>
          {c.destinatarios?.length ? (
            <div><h3 className="text-xs font-semibold text-tinta/50 uppercase mt-2 mb-1">Suele enviar a</h3>
              <ul className="text-sm space-y-1">{c.destinatarios.map((d, i) => <li key={i}>👤 <b>{d.recibe_nombre}</b> · {d.zona_nombre || ''} {d.direccion || ''} <span className="text-tinta/40">×{d.veces}</span></li>)}</ul></div>
          ) : null}
        </section>
        <section className="tarjeta p-4 space-y-3">
          <h2 className="font-bold text-sm">Fechas importantes</h2>
          <p className="text-xs text-tinta/60">Se registran solas con cada pedido de cumpleaños o aniversario. {config?.seguimientos.recompra ? `Se le recuerda ${config.seguimientos.recompra_dias_antes} días antes.` : ''}</p>
          <ul className="space-y-1.5 text-sm">
            {c.fechas?.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg bg-rosa-50 px-3 py-1.5">
                <span>🎉 <b>{f.dia_mes.split('-').reverse().join('/')}</b> · {f.descripcion || ocasionN(f.tipo)}</span>
                <button className="text-xs text-red-600 cursor-pointer" onClick={() => api.quitarFecha(c.id, f.id).then(cargar)}>quitar</button>
              </li>
            ))}
            {!c.fechas?.length ? <li className="text-tinta/40">Ninguna todavía</li> : null}
          </ul>
          <div className="grid grid-cols-4 gap-2 items-end">
            <Campo etiqueta="Tipo" clase="col-span-2"><select className="campo" value={fecha.tipo} onChange={(e) => setFecha({ ...fecha, tipo: e.target.value })}>{config?.ocasiones.map((o) => <option key={o.clave} value={o.clave}>{o.nombre}</option>)}</select></Campo>
            <Campo etiqueta="Día"><input className="campo" inputMode="numeric" placeholder="DD" value={fecha.dia} onChange={(e) => setFecha({ ...fecha, dia: e.target.value })} /></Campo>
            <Campo etiqueta="Mes"><input className="campo" inputMode="numeric" placeholder="MM" value={fecha.mes} onChange={(e) => setFecha({ ...fecha, mes: e.target.value })} /></Campo>
            <Campo etiqueta="Descripción" clase="col-span-3"><input className="campo" value={fecha.descripcion} onChange={(e) => setFecha({ ...fecha, descripcion: e.target.value })} placeholder="Cumpleaños de su mamá" /></Campo>
            <button className="boton-suave" onClick={() => api.agregarFecha(c.id, { tipo: fecha.tipo, dia_mes: `${fecha.mes.padStart(2, '0')}-${fecha.dia.padStart(2, '0')}`, descripcion: fecha.descripcion }).then(() => { setFecha({ tipo: 'cumpleanos', dia: '', mes: '', descripcion: '' }); cargar(); }).catch((e) => avisar(e.message, 'error'))}>Agregar</button>
          </div>
        </section>
      </div>
      <section className="tarjeta">
        <h2 className="font-bold text-sm px-4 py-3 border-b border-rosa-100">Historial de pedidos</h2>
        <div className="divide-y divide-rosa-50">
          {pedidos.map((p) => (
            <Link key={p.id} to={`/pedidos/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-rosa-50">
              <span className="font-mono text-xs font-bold text-rosa-600">{p.codigo}</span>
              <div className="min-w-0 flex-1"><p className="text-sm truncate">{p.resumen_items}</p><p className="text-xs text-tinta/60">{relativa(p.fecha_entrega)}{p.recibe_nombre ? ` · para ${p.recibe_nombre}` : ''}{p.ocasion ? ` · ${ocasionN(p.ocasion)}` : ''}</p></div>
              <Insignia clase={ESTADO[p.estado as Estado].clase}>{ESTADO[p.estado as Estado].nombre}</Insignia>
              <b className="text-sm">{pesos(p.total)}</b>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
