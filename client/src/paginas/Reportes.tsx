import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api, type Reporte } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, Stat } from '../componentes/ui';
import { pesos, hoy, sumarDias, fechaCorta } from '../lib/formato';
import { ESTADO, type Estado } from '../lib/estados';

const COLORES = ['#E84090', '#F56BAA', '#FF9CC6', '#A81E60', '#FFC6DE', '#7E174A', '#CF2A79', '#5A1136'];

export default function Reportes() {
  const { config } = useSesion();
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [r, setR] = useState<Reporte | null>(null);
  useEffect(() => { setR(null); api.reportes(desde, hasta).then(setR); }, [desde, hasta]);
  const canalN = (k: string) => config?.canales.find((c) => c.clave === k)?.nombre || k;
  const medioN = (k: string) => config?.medios_pago.find((c) => c.clave === k)?.nombre || k;
  const ocasionN = (k: string) => config?.ocasiones.find((c) => c.clave === k)?.nombre || (k === 'sin_ocasion' ? 'Sin ocasión' : k);
  const atajos: [string, string, string][] = [['Hoy', hoy(), hoy()], ['7 días', sumarDias(hoy(), -6), hoy()], ['30 días', sumarDias(hoy(), -29), hoy()], ['Este mes', hoy().slice(0, 8) + '01', hoy()], ['Mes pasado', sumarDias(hoy().slice(0, 8) + '01', -1).slice(0, 8) + '01', sumarDias(hoy().slice(0, 8) + '01', -1)]];

  return (
    <div className="space-y-4">
      <Encabezado titulo="Reportes" sub="Ventas, canales, productos y clientes" acciones={<a href={`/api/reportes/excel?desde=${desde}&hasta=${hasta}`} className="boton-primario"><Download className="size-4" /> Excel</a>} />
      <div className="flex flex-wrap items-center gap-2">
        {atajos.map(([t, d, h]) => <button key={t} onClick={() => { setDesde(d); setHasta(h); }} className={`insignia py-1.5 px-3 text-sm cursor-pointer ${desde === d && hasta === h ? 'bg-rosa-500 text-white' : 'bg-white border border-rosa-200'}`}>{t}</button>)}
        <input type="date" className="campo w-auto py-1.5" value={desde} onChange={(e) => setDesde(e.target.value)} /><span className="text-sm">a</span><input type="date" className="campo w-auto py-1.5" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </div>
      {!r ? <Cargando /> : (<>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat etiqueta="Ventas" valor={pesos(r.totales.ventas)} sub={`${r.totales.pedidos} pedidos`} />
          <Stat etiqueta="Ticket promedio" valor={pesos(r.totales.ticket)} />
          <Stat etiqueta="Cobrado" valor={pesos(r.totales.cobrado)} sub={r.totales.ventas ? `${Math.round(r.totales.cobrado * 100 / r.totales.ventas)}% de lo vendido` : ''} />
          <Stat etiqueta="Domicilios" valor={pesos(r.totales.domicilios)} />
          <Stat etiqueta="Clientes nuevos" valor={r.nuevosClientes} sub={`${r.puntualidad.con_foto}/${r.puntualidad.entregados} entregas con foto`} />
        </div>
        <div className="tarjeta p-4">
          <h2 className="font-bold text-sm mb-2">Ventas por día</h2>
          <div className="h-56">
            <ResponsiveContainer><BarChart data={r.porDia.map((x) => ({ ...x, dia: fechaCorta(x.fecha) }))}><XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={36} /><Tooltip formatter={(v) => pesos(Number(v))} /><Bar dataKey="ventas" fill="#E84090" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Torta titulo="Por canal de venta" datos={r.porCanal.map((x) => ({ nombre: canalN(x.canal), valor: x.ventas, n: x.pedidos }))} />
          <Torta titulo="Por ocasión" datos={r.porOcasion.map((x) => ({ nombre: ocasionN(x.ocasion), valor: x.ventas, n: x.pedidos }))} />
          <Tabla titulo="Medios de pago" filas={r.porMedio.map((x) => [medioN(x.medio), String(x.pagos), pesos(x.total)])} cab={['Medio', 'Pagos', 'Total']} />
          <Tabla titulo="Pedidos por estado" filas={r.porEstado.map((x) => [ESTADO[x.estado as Estado]?.nombre || x.estado, String(x.pedidos), pesos(x.ventas)])} cab={['Estado', 'Pedidos', 'Ventas']} />
          <Tabla titulo="Productos más vendidos" filas={r.productos.map((x) => [x.nombre, String(x.unidades), pesos(x.ventas)])} cab={['Producto', 'Unid.', 'Ventas']} />
          <Tabla titulo="Zonas más frecuentes" filas={r.porZona.map((x) => [x.zona, String(x.pedidos), pesos(x.domicilios)])} cab={['Zona', 'Pedidos', 'Domicilios']} />
          <Tabla titulo="Mejores clientes" filas={r.clientesTop.map((x) => [<Link key={x.id} to={`/clientes/${x.id}`} className="text-rosa-600">{x.nombre || x.telefono}</Link>, String(x.pedidos), pesos(x.ventas)])} cab={['Cliente', 'Pedidos', 'Ventas']} />
          <Tabla titulo="Origen" filas={r.porOrigen.map((x) => [x.origen === 'bot' ? '🤖 Agente de WhatsApp' : 'Equipo (sistema)', String(x.pedidos), pesos(x.ventas)])} cab={['Origen', 'Pedidos', 'Ventas']} />
        </div>
        <Tabla titulo="Semanas" filas={r.porSemana.map((x) => [`Semana del ${fechaCorta(x.desde)}`, String(x.pedidos), pesos(x.ventas)])} cab={['Semana', 'Pedidos', 'Ventas']} />
      </>)}
    </div>
  );
}
function Torta({ titulo, datos }: { titulo: string; datos: { nombre: string; valor: number; n: number }[] }) {
  const total = datos.reduce((s, d) => s + d.valor, 0);
  return (
    <div className="tarjeta p-4"><h2 className="font-bold text-sm mb-2">{titulo}</h2>
      {!datos.length ? <p className="text-sm text-tinta/40 py-6 text-center">Sin datos</p> : (
        <div className="flex items-center gap-3">
          <div className="h-40 w-40 shrink-0"><ResponsiveContainer><PieChart><Pie data={datos} dataKey="valor" nameKey="nombre" innerRadius={40} outerRadius={70} paddingAngle={2}>{datos.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}</Pie><Tooltip formatter={(v) => pesos(Number(v))} /></PieChart></ResponsiveContainer></div>
          <ul className="text-xs space-y-1 flex-1 min-w-0">{datos.map((d, i) => <li key={d.nombre} className="flex items-center gap-2"><span className="size-2.5 rounded-full shrink-0" style={{ background: COLORES[i % COLORES.length] }} /><span className="truncate flex-1">{d.nombre}</span><span className="text-tinta/60">{d.n}</span><b>{total ? Math.round(d.valor * 100 / total) : 0}%</b></li>)}</ul>
        </div>
      )}
    </div>
  );
}
function Tabla({ titulo, cab, filas }: { titulo: string; cab: string[]; filas: React.ReactNode[][] }) {
  return (
    <div className="tarjeta p-4"><h2 className="font-bold text-sm mb-2">{titulo}</h2>
      {!filas.length ? <p className="text-sm text-tinta/40 py-4 text-center">Sin datos</p> : (
        <table className="w-full text-sm"><thead><tr className="text-[11px] uppercase text-tinta/50">{cab.map((c, i) => <th key={c} className={`py-1 ${i ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr></thead>
          <tbody>{filas.map((f, i) => <tr key={i} className="border-t border-rosa-50">{f.map((c, j) => <td key={j} className={`py-1.5 ${j ? 'text-right tabular-nums' : ''}`}>{c}</td>)}</tr>)}</tbody></table>
      )}
    </div>
  );
}
