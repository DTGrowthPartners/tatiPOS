import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, LogOut, MapPin, Phone, Printer, RefreshCw, MessageCircle } from 'lucide-react';
import { api, type Pedido } from '../api';
import { useSesion } from '../App';
import { Cargando, Insignia, useToast } from '../componentes/ui';
import { pesos, relativa, telefonoBonito, enlaceWa, hoy } from '../lib/formato';
import { ESTADO, type Estado } from '../lib/estados';

// Pantalla única del domiciliario: sus entregas, en orden, con lo justo para
// llegar, cobrar si toca y cerrar con foto.
export default function MisEntregas() {
  const { usuario, config, salir } = useSesion();
  const { avisar } = useToast();
  const [lista, setLista] = useState<Pedido[] | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const pedidoFoto = useRef<Pedido | null>(null);
  const cargar = () => api.misEntregas().then(setLista).catch((e) => avisar(e.message, 'error'));
  useEffect(() => { cargar(); const t = setInterval(cargar, 60_000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const franjaN = (c: string | null) => config?.franjas.find((f) => f.clave === c)?.nombre || '';

  async function estado(p: Pedido, e: Estado) {
    try { await api.cambiarEstado(p.id, e); await cargar(); avisar(`${p.codigo}: ${ESTADO[e].nombre}`); } catch (err) { avisar((err as Error).message, 'error'); }
  }
  async function conFoto(f: File) {
    const p = pedidoFoto.current; if (!p) return;
    setSubiendo(p.id);
    try { await api.evidencia(p.id, f, true); await cargar(); avisar(`${p.codigo} entregado ✅`); } catch (e) { avisar((e as Error).message, 'error'); } finally { setSubiendo(null); }
  }
  const pendientes = (lista || []).filter((p) => p.estado !== 'entregado');
  const entregados = (lista || []).filter((p) => p.estado === 'entregado');

  return (
    <div className="min-h-dvh bg-rosa-50">
      <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) conFoto(f); e.target.value = ''; }} />
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-rosa-100 px-4 py-2.5 flex items-center justify-between">
        <img src="/logo-emblema.png" alt="Floristería Tati Ramos" className="h-12 w-auto" />
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-tinta/60 mr-1">🛵 {usuario?.nombre?.split(' ')[0]}</span>
          <button onClick={cargar} className="p-2 rounded-lg hover:bg-rosa-100 cursor-pointer" aria-label="Actualizar"><RefreshCw className="size-4" /></button>
          <button onClick={salir} className="p-2 rounded-lg hover:bg-rosa-100 cursor-pointer" aria-label="Salir"><LogOut className="size-4" /></button>
        </div>
      </header>
      <main className="px-4 py-4 max-w-2xl mx-auto space-y-3 pb-10">
        <h1 className="text-xl font-extrabold">Mis entregas <span className="text-rosa-500">{pendientes.length}</span></h1>
        {!lista ? <Cargando /> : !pendientes.length ? <p className="tarjeta p-8 text-center text-sm text-tinta/60">Sin entregas pendientes 🌸</p> : null}
        {pendientes.map((p) => {
          const est = ESTADO[p.estado as Estado];
          const cobrar = p.total - p.pagado;
          const direccion = [p.direccion, p.zona_nombre, config?.negocio.ciudad].filter(Boolean).join(', ');
          return (
            <div key={p.id} className={`tarjeta p-4 space-y-2 ${p.urgente ? 'border-red-300' : ''} ${p.estado === 'en_ruta' ? 'ring-2 ring-orange-300' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-rosa-600">{p.codigo}</span>
                <Insignia clase={est.clase}>{est.nombre}</Insignia>
                {p.urgente ? <Insignia clase="bg-red-100 text-red-700">Urgente</Insignia> : null}
                <span className="text-xs text-tinta/60 ml-auto"><b className={p.fecha_entrega < hoy() ? 'text-red-600' : ''}>{relativa(p.fecha_entrega)}</b> {franjaN(p.franja)} {p.hora_entrega || ''}</span>
              </div>
              <p className="text-sm font-semibold">{p.resumen_items}</p>
              {p.ocasion === 'funebre' ? <p className="text-sm">🕊️ {p.fallecido} · {[p.funeraria, p.sala && `sala ${p.sala}`].filter(Boolean).join(' · ')}</p> : <p className="text-lg font-bold">{p.recibe_nombre || p.cliente_nombre}</p>}
              <p className="text-sm">📍 {p.direccion}{p.punto_referencia ? <span className="text-tinta/60"> ({p.punto_referencia})</span> : null}<br /><span className="text-tinta/60">{p.zona_nombre}</span></p>
              {(p.tarjeta_para || p.tarjeta_de) ? <p className="text-xs text-tinta/60">💌 Para {p.tarjeta_para || '—'} · De {p.tarjeta_de || '—'}</p> : null}
              {p.especificaciones ? <p className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">✨ {p.especificaciones}</p> : null}
              <div className={`rounded-lg px-3 py-2 text-sm font-bold ${cobrar > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{cobrar > 0 ? `⚠️ Cobrar ${pesos(cobrar)} al entregar` : '✅ Pagado, no cobrar nada'}</div>
              <div className="grid grid-cols-3 gap-2">
                <a href={`tel:${p.recibe_telefono || p.cliente_telefono}`} className="boton-secundario py-2.5 text-xs"><Phone className="size-4" /> Llamar</a>
                <a href={enlaceWa(p.recibe_telefono || p.cliente_telefono, `Hola, soy el domiciliario de Floristería Tati Ramos 🌸 voy con su pedido ${p.codigo}.`)} target="_blank" rel="noreferrer" className="boton-secundario py-2.5 text-xs"><MessageCircle className="size-4" /> WhatsApp</a>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`} target="_blank" rel="noreferrer" className="boton-secundario py-2.5 text-xs"><MapPin className="size-4" /> Mapa</a>
              </div>
              <p className="text-[11px] text-tinta/50">Tel. recibe: {telefonoBonito(p.recibe_telefono) || '—'} · cliente: {telefonoBonito(p.cliente_telefono) || '—'}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {p.estado !== 'en_ruta' ? <button onClick={() => estado(p, 'en_ruta')} className="boton-suave flex-1 py-3">Salí con este pedido →</button> : (<>
                  <button disabled={subiendo === p.id} onClick={() => { pedidoFoto.current = p; fotoRef.current?.click(); }} className="boton-primario flex-1 py-3"><Camera className="size-4" /> {subiendo === p.id ? 'Subiendo…' : 'Entregado + foto'}</button>
                  <button onClick={() => confirm('¿Marcar entregado sin foto?') && estado(p, 'entregado')} className="boton-fantasma py-3 text-xs">sin foto</button>
                </>)}
                <Link to={`/pedidos/${p.id}/guia`} className="boton-fantasma py-3 text-xs"><Printer className="size-4" /></Link>
              </div>
            </div>
          );
        })}
        {entregados.length ? (
          <div className="pt-2">
            <h2 className="text-sm font-bold text-tinta/60 mb-2">Entregados hoy ({entregados.length})</h2>
            {entregados.map((p) => <div key={p.id} className="tarjeta p-3 text-sm flex items-center gap-2 opacity-70 mb-2"><span className="font-mono text-xs font-bold text-rosa-600">{p.codigo}</span><span className="flex-1 truncate">{p.recibe_nombre || p.cliente_nombre} · {p.zona_nombre}</span><span className="text-xs text-tinta/50">{p.hora_entregado}</span>{p.evidencia_foto ? <span>📷</span> : null}</div>)}
          </div>
        ) : null}
      </main>
    </div>
  );
}
