import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Caja as CajaT } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, SelectorFecha, Stat, useToast } from '../componentes/ui';
import { pesos, hoy, fechaLarga, fechaHora } from '../lib/formato';

export default function Caja() {
  const { esAdmin } = useSesion();
  const { avisar } = useToast();
  const [fecha, setFecha] = useState(hoy());
  const [c, setC] = useState<CajaT | null>(null);
  const [recibido, setRecibido] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState('');
  const [historial, setHistorial] = useState<Awaited<ReturnType<typeof api.historialCaja>>>([]);
  const cargar = () => api.caja(fecha).then((x) => { setC(x); const r: Record<string, string> = {}; for (const m of x.porMedio) r[m.medio] = x.cierre ? String(x.cierre.recibido[m.medio] ?? '') : ''; setRecibido(r); setNotas(x.cierre?.notas || ''); });
  useEffect(() => { setC(null); cargar(); if (esAdmin) api.historialCaja().then(setHistorial); }, [fecha]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <Cargando />;
  const totalRec = Object.values(recibido).reduce((s, v) => s + (Number(v) || 0), 0);
  const dif = totalRec - c.total;

  return (
    <div className="space-y-4">
      <Encabezado titulo="Cuadre de caja" sub={<span className="inline-block first-letter:uppercase">{fechaLarga(fecha)}</span>} acciones={<SelectorFecha valor={fecha} onChange={setFecha} />} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat etiqueta="Cobrado en el día" valor={pesos(c.total)} sub={`${c.pagos.length} pagos`} />
        <Stat etiqueta="Ventas con entrega hoy" valor={pesos(c.ventasDia.total)} sub={`${c.ventasDia.pedidos} pedidos`} />
        <Stat etiqueta="Pendiente por cobrar (hoy)" valor={pesos(c.pendiente)} clase={c.pendiente ? 'border-red-200' : ''} />
        <Stat etiqueta="Cierre" valor={c.cierre ? (c.cierre.diferencia === 0 ? '✅ Cuadra' : `${c.cierre.diferencia > 0 ? '+' : ''}${pesos(c.cierre.diferencia)}`) : 'Abierta'} sub={c.cierre ? `${c.cierre.cerrado_por_nombre} · ${fechaHora(c.cierre.cerrado_en)}` : 'sin cerrar'} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="tarjeta p-4">
          <h2 className="font-bold text-sm mb-3">Por método de pago</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase text-tinta/50"><th className="text-left py-1">Medio</th><th className="text-right">Registrado</th><th className="text-right">Recibido</th><th className="text-right">Dif.</th></tr></thead>
            <tbody>
              {c.porMedio.filter((m) => m.total || recibido[m.medio]).concat(c.porMedio.filter((m) => !m.total && !recibido[m.medio])).map((m) => {
                const rec = recibido[m.medio] === '' || recibido[m.medio] === undefined ? null : Number(recibido[m.medio]) || 0;
                const d = rec === null ? null : rec - m.total;
                return (
                  <tr key={m.medio} className="border-t border-rosa-50">
                    <td className="py-1.5">{m.nombre} <span className="text-tinta/40 text-xs">{m.pagos ? `×${m.pagos}` : ''}</span></td>
                    <td className="text-right tabular-nums">{pesos(m.total)}</td>
                    <td className="text-right"><input className="campo w-28 py-1 text-right inline-block" inputMode="numeric" placeholder={String(m.total)} disabled={!esAdmin} value={recibido[m.medio] ?? ''} onChange={(e) => setRecibido({ ...recibido, [m.medio]: e.target.value })} /></td>
                    <td className={`text-right tabular-nums text-xs ${d === null ? 'text-tinta/30' : d === 0 ? 'text-green-700' : 'text-red-600'}`}>{d === null ? '—' : d === 0 ? 'ok' : `${d > 0 ? '+' : ''}${pesos(d)}`}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-rosa-200 font-bold"><td className="py-2">Total</td><td className="text-right">{pesos(c.total)}</td><td className="text-right">{pesos(totalRec)}</td><td className={`text-right text-xs ${dif === 0 ? 'text-green-700' : 'text-red-600'}`}>{dif === 0 ? 'cuadra' : `${dif > 0 ? '+' : ''}${pesos(dif)}`}</td></tr>
            </tbody>
          </table>
          {esAdmin ? (<>
            <textarea className="campo mt-3" rows={2} placeholder="Notas del cierre (faltante, sobrante, motivo…)" value={notas} onChange={(e) => setNotas(e.target.value)} />
            <button onClick={() => { const r: Record<string, number> = {}; for (const [k, v] of Object.entries(recibido)) if (v !== '') r[k] = Number(v) || 0; api.cerrarCaja({ fecha, recibido: r, notas }).then(() => { avisar(c.cierre ? 'Cierre actualizado' : 'Caja cerrada'); cargar(); api.historialCaja().then(setHistorial); }).catch((e) => avisar(e.message, 'error')); }} className="boton-primario w-full mt-2 py-3">{c.cierre ? 'Actualizar cierre' : 'Cerrar caja del día'}</button>
          </>) : <p className="text-xs text-tinta/50 mt-3">El cierre lo hace la administradora.</p>}
        </section>
        <section className="tarjeta p-4">
          <h2 className="font-bold text-sm mb-3">Pagos del día</h2>
          {!c.pagos.length ? <p className="text-sm text-tinta/40 py-6 text-center">Sin pagos registrados este día</p> : (
            <div className="divide-y divide-rosa-50 text-sm max-h-96 overflow-y-auto">
              {c.pagos.map((p) => (
                <div key={p.id} className="py-2 flex items-center gap-2">
                  <span className="text-xs text-tinta/50 w-10">{p.fecha.slice(11, 16)}</span>
                  <Link to={`/pedidos/${p.pedido_id}`} className="font-mono text-xs font-bold text-rosa-600">{p.codigo}</Link>
                  <span className="flex-1 truncate">{p.cliente_nombre || ''} <span className="text-tinta/50">· {c.porMedio.find((m) => m.medio === p.medio)?.nombre || p.medio}</span>{p.comprobante ? <a href={`/uploads/${p.comprobante}`} target="_blank" rel="noreferrer" className="text-xs text-rosa-600 ml-1">📎</a> : null}</span>
                  <b className="tabular-nums">{pesos(p.monto)}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {esAdmin && historial.length ? (
        <section className="tarjeta p-4"><h2 className="font-bold text-sm mb-2">Cierres anteriores</h2>
          <table className="w-full text-sm"><thead><tr className="text-[11px] uppercase text-tinta/50"><th className="text-left py-1">Fecha</th><th className="text-right">Registrado</th><th className="text-right">Recibido</th><th className="text-right">Diferencia</th><th className="text-left pl-3">Notas</th></tr></thead>
            <tbody>{historial.map((h) => { const reg = Object.values(h.registrado).reduce((s, v) => s + v, 0); const rec = Object.values(h.recibido).reduce((s, v) => s + v, 0); return (
              <tr key={h.id} className="border-t border-rosa-50 cursor-pointer hover:bg-rosa-50" onClick={() => setFecha(h.fecha)}><td className="py-1.5">{h.fecha}</td><td className="text-right tabular-nums">{pesos(reg)}</td><td className="text-right tabular-nums">{pesos(rec)}</td><td className={`text-right tabular-nums ${h.diferencia === 0 ? 'text-green-700' : 'text-red-600'}`}>{h.diferencia === 0 ? 'cuadra' : pesos(h.diferencia)}</td><td className="pl-3 text-xs text-tinta/60 truncate max-w-[200px]">{h.notas}</td></tr>); })}</tbody></table>
        </section>
      ) : null}
    </div>
  );
}
