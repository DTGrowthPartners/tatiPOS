import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Trash2, Plus, Minus } from 'lucide-react';
import { api, type Producto, type Zona, type Item, type Pedido, type Cliente } from '../api';
import { useSesion } from '../App';
import { Campo, Cargando, Encabezado, useToast } from '../componentes/ui';
import { pesos, hoy, sumarDias, telefonoBonito } from '../lib/formato';

type Form = {
  canal: string; cliente_nombre: string; cliente_telefono: string; cliente_email: string;
  tipo_entrega: 'domicilio' | 'recoge'; fecha_entrega: string; franja: string; hora_entrega: string;
  zona_id: string; zona_nombre: string; domicilio_valor: string; direccion: string; punto_referencia: string;
  recibe_nombre: string; recibe_telefono: string; tarjeta_para: string; tarjeta_mensaje: string; tarjeta_de: string;
  ocasion: string; funeraria: string; sala: string; fallecido: string; especificaciones: string; notas_internas: string;
  medio_pago_previsto: string; recargo_pct: string; descuento: string; urgente: boolean; estado_inicial: 'nuevo' | 'confirmado';
};

export default function PedidoForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { config } = useSesion();
  const { avisar } = useToast();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [f, setF] = useState<Form>({
    canal: 'whatsapp', cliente_nombre: '', cliente_telefono: '', cliente_email: '', tipo_entrega: 'domicilio', fecha_entrega: hoy(), franja: '', hora_entrega: '',
    zona_id: '', zona_nombre: '', domicilio_valor: '', direccion: '', punto_referencia: '', recibe_nombre: '', recibe_telefono: '', tarjeta_para: '', tarjeta_mensaje: '', tarjeta_de: '',
    ocasion: '', funeraria: '', sala: '', fallecido: '', especificaciones: '', notas_internas: '', medio_pago_previsto: '', recargo_pct: '', descuento: '', urgente: false, estado_inicial: 'nuevo',
  });
  const [cargando, setCargando] = useState(Boolean(id));
  const [guardando, setGuardando] = useState(false);
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState('');
  const [libre, setLibre] = useState({ nombre: '', precio: '' });
  const [buscaZona, setBuscaZona] = useState('');
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
  const telRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    Promise.all([api.productos(), api.zonas()]).then(([p, z]) => { setProductos(p); setZonas(z); });
    if (id) {
      api.pedido(Number(id)).then((p: Pedido) => {
        setItems((p.items || []).map((i) => ({ producto_id: i.producto_id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, nota: i.nota })));
        setF((a) => ({ ...a, canal: p.canal, cliente_nombre: p.cliente_nombre || '', cliente_telefono: p.cliente_telefono || '', tipo_entrega: p.tipo_entrega, fecha_entrega: p.fecha_entrega, franja: p.franja || '', hora_entrega: p.hora_entrega || '',
          zona_id: p.zona_id ? String(p.zona_id) : '', zona_nombre: p.zona_nombre || '', domicilio_valor: String(p.domicilio_valor), direccion: p.direccion || '', punto_referencia: p.punto_referencia || '',
          recibe_nombre: p.recibe_nombre || '', recibe_telefono: p.recibe_telefono || '', tarjeta_para: p.tarjeta_para || '', tarjeta_mensaje: p.tarjeta_mensaje || '', tarjeta_de: p.tarjeta_de || '',
          ocasion: p.ocasion || '', funeraria: p.funeraria || '', sala: p.sala || '', fallecido: p.fallecido || '', especificaciones: p.especificaciones || '', notas_internas: p.notas_internas || '',
          recargo_pct: p.subtotal + p.domicilio_valor - p.descuento > 0 ? String(Math.round(p.recargo * 100 / (p.subtotal + p.domicilio_valor - p.descuento))) : '0', descuento: String(p.descuento), urgente: Boolean(p.urgente) }));
        setBuscaZona(p.zona_nombre || '');
        setCargando(false);
      });
    }
  }, [id]);

  // Sugerir clientes por teléfono/nombre (CRM)
  useEffect(() => {
    const q = f.cliente_telefono.replace(/\D/g, '').length >= 4 ? f.cliente_telefono : f.cliente_nombre.length >= 3 ? f.cliente_nombre : '';
    if (!q || id) { setSugerencias([]); return; }
    window.clearTimeout(telRef.current);
    telRef.current = window.setTimeout(() => api.clientes(q).then((c) => setSugerencias(c.slice(0, 5))).catch(() => {}), 300);
  }, [f.cliente_telefono, f.cliente_nombre, id]);

  const set = (k: keyof Form, v: string | boolean) => setF((a) => ({ ...a, [k]: v }));
  const categorias = useMemo(() => { const s = new Set<string>(); productos.forEach((p) => String(p.categoria || '').split(',').forEach((c) => c.trim() && s.add(c.trim()))); return [...s].sort(); }, [productos]);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return productos.filter((p) => (!cat || String(p.categoria || '').includes(cat)) && (!q || p.nombre.toLowerCase().includes(q) || p.id.toLowerCase() === q)).slice(0, 40);
  }, [productos, busca, cat]);
  const zonasFiltradas = useMemo(() => { const q = buscaZona.trim().toLowerCase(); return q.length < 2 ? [] : zonas.filter((z) => z.zona.toLowerCase().includes(q)).slice(0, 8); }, [zonas, buscaZona]);

  const agregar = (p: Producto) => setItems((l) => {
    const i = l.findIndex((x) => x.producto_id === p.id);
    if (i >= 0) { const c = [...l]; c[i] = { ...c[i], cantidad: c[i].cantidad + 1 }; return c; }
    return [...l, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio: p.precio, imagen: p.imagen }];
  });
  const agregarLibre = () => {
    if (!libre.nombre.trim()) return;
    setItems((l) => [...l, { producto_id: null, nombre: libre.nombre.trim(), cantidad: 1, precio: Number(libre.precio) || 0 }]);
    setLibre({ nombre: '', precio: '' });
  };
  const cambiarItem = (i: number, c: Partial<Item>) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const medio = config?.medios_pago.find((m) => m.clave === f.medio_pago_previsto);
  const recargoPct = f.recargo_pct !== '' ? Number(f.recargo_pct) : (medio?.recargo || 0);
  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const zona = zonas.find((z) => String(z.id) === f.zona_id);
  const domicilio = f.tipo_entrega === 'recoge' ? 0 : (f.domicilio_valor !== '' ? Number(f.domicilio_valor) : (zona?.precio || 0));
  const base = subtotal + domicilio - (Number(f.descuento) || 0);
  const recargo = Math.round(base * recargoPct / 100);
  const total = Math.max(0, base + recargo);
  const franjas = config?.franjas || [];
  const esFunebre = f.ocasion === 'funebre';

  async function guardar() {
    if (!items.length) return avisar('Agregue al menos un producto o arreglo', 'error');
    if (!f.cliente_telefono.trim() && !f.cliente_nombre.trim()) return avisar('Ponga al menos el teléfono o el nombre del cliente', 'error');
    setGuardando(true);
    try {
      const cuerpo = { ...f, items, zona_id: f.zona_id || null, domicilio_valor: f.tipo_entrega === 'recoge' ? 0 : domicilio, recargo_pct: recargoPct };
      const p = id ? await api.editarPedido(Number(id), cuerpo) : await api.crearPedido(cuerpo);
      avisar(id ? 'Pedido actualizado' : `Pedido ${p.codigo} creado`);
      nav(`/pedidos/${p.id}`, { replace: true });
    } catch (e) { avisar((e as Error).message, 'error'); }
    finally { setGuardando(false); }
  }

  if (cargando) return <Cargando />;

  return (
    <div className="max-w-5xl">
      <Encabezado titulo={id ? 'Editar pedido' : 'Nuevo pedido'} sub={id ? '' : 'Producto, entrega, tarjeta y pago en un solo paso'} />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {/* 1. Cliente */}
          <Seccion n={1} titulo="Quién pide">
            <div className="grid sm:grid-cols-2 gap-3">
              <Campo etiqueta="Teléfono (WhatsApp)"><input className="campo" inputMode="tel" placeholder="300 123 4567" value={f.cliente_telefono} onChange={(e) => set('cliente_telefono', e.target.value)} /></Campo>
              <Campo etiqueta="Nombre"><input className="campo" value={f.cliente_nombre} onChange={(e) => set('cliente_nombre', e.target.value)} /></Campo>
              <Campo etiqueta="Canal">
                <select className="campo" value={f.canal} onChange={(e) => set('canal', e.target.value)}>{config?.canales.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}</select>
              </Campo>
              <Campo etiqueta="Correo (opcional)"><input className="campo" type="email" value={f.cliente_email} onChange={(e) => set('cliente_email', e.target.value)} /></Campo>
            </div>
            {sugerencias.length ? (
              <div className="mt-2 rounded-xl border border-rosa-200 bg-rosa-50 divide-y divide-rosa-100">
                {sugerencias.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setF((a) => ({ ...a, cliente_nombre: c.nombre || a.cliente_nombre, cliente_telefono: c.telefono || a.cliente_telefono, cliente_email: c.email || '' })); setSugerencias([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-rosa-100 cursor-pointer flex justify-between">
                    <span><b>{c.nombre || 'Sin nombre'}</b> · {telefonoBonito(c.telefono)}</span><span className="text-xs text-tinta/60">{c.pedidos as number} pedidos · {pesos(c.valor)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </Seccion>

          {/* 2. Productos */}
          <Seccion n={2} titulo="Qué lleva">
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1"><Search className="size-4 absolute left-3 top-3 text-tinta/40" /><input className="campo pl-9" placeholder="Buscar en el catálogo…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
              <select className="campo w-auto max-w-[45%]" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            {(busca || cat) ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1 mb-3">
                {filtrados.map((p) => (
                  <button key={p.id} type="button" onClick={() => agregar(p)} className="tarjeta overflow-hidden text-left hover:border-rosa-400 cursor-pointer">
                    <div className="aspect-square bg-rosa-50">{p.imagen ? <img src={`/fotos/${p.imagen}`} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🌷</div>}</div>
                    <div className="p-1.5"><p className="text-[11px] font-semibold leading-tight line-clamp-2">{p.nombre}</p><p className="text-xs font-bold text-rosa-600">{pesos(p.precio)}</p></div>
                  </button>
                ))}
                {!filtrados.length ? <p className="col-span-full text-sm text-tinta/50 py-4 text-center">Nada con ese nombre. Agréguelo abajo como arreglo libre.</p> : null}
              </div>
            ) : null}
            <div className="flex gap-2 mb-3">
              <input className="campo flex-1" placeholder="Arreglo libre o adicional (ej: 12 rosas con globo)" value={libre.nombre} onChange={(e) => setLibre({ ...libre, nombre: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarLibre())} />
              <input className="campo w-28" inputMode="numeric" placeholder="Precio" value={libre.precio} onChange={(e) => setLibre({ ...libre, precio: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarLibre())} />
              <button type="button" onClick={agregarLibre} className="boton-suave px-3"><Plus className="size-4" /></button>
            </div>
            {items.length ? (
              <div className="divide-y divide-rosa-100 rounded-xl border border-rosa-100">
                {items.map((it, i) => (
                  <div key={i} className="p-2.5 flex items-center gap-2">
                    {it.imagen ? <img src={`/fotos/${it.imagen}`} alt="" className="size-10 rounded-lg object-cover" /> : <div className="size-10 rounded-lg bg-rosa-50 flex items-center justify-center">🌷</div>}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{it.nombre}</p>
                      <input className="text-xs w-full bg-transparent focus:outline-none text-tinta/60 placeholder:text-tinta/30" placeholder="Nota: color, cambio, adicional…" value={it.nota || ''} onChange={(e) => cambiarItem(i, { nota: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" className="p-1 rounded-md hover:bg-rosa-100 cursor-pointer" onClick={() => cambiarItem(i, { cantidad: Math.max(1, it.cantidad - 1) })}><Minus className="size-3.5" /></button>
                      <span className="w-6 text-center text-sm font-bold">{it.cantidad}</span>
                      <button type="button" className="p-1 rounded-md hover:bg-rosa-100 cursor-pointer" onClick={() => cambiarItem(i, { cantidad: it.cantidad + 1 })}><Plus className="size-3.5" /></button>
                    </div>
                    <input className="campo w-24 py-1.5 text-right text-sm" inputMode="numeric" value={it.precio} onChange={(e) => cambiarItem(i, { precio: Number(e.target.value) || 0 })} />
                    <button type="button" className="p-1.5 text-tinta/40 hover:text-red-600 cursor-pointer" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-tinta/50 text-center py-3">Busque en el catálogo o escriba un arreglo libre.</p>}
          </Seccion>

          {/* 3. Entrega */}
          <Seccion n={3} titulo="Cuándo y dónde">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['domicilio', 'recoge'] as const).map((t) => (
                <button key={t} type="button" onClick={() => set('tipo_entrega', t)} className={`rounded-xl border-2 p-3 text-sm font-semibold cursor-pointer ${f.tipo_entrega === t ? 'border-rosa-500 bg-rosa-50 text-rosa-700' : 'border-rosa-100 text-tinta/60'}`}>{t === 'domicilio' ? '🛵 Domicilio' : '🏪 Recoge en tienda'}</button>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Campo etiqueta="Fecha de entrega">
                <input className="campo" type="date" value={f.fecha_entrega} min={sumarDias(hoy(), -1)} onChange={(e) => set('fecha_entrega', e.target.value)} />
              </Campo>
              <Campo etiqueta="Franja">
                <select className="campo" value={f.franja} onChange={(e) => set('franja', e.target.value)}><option value="">Sin franja</option>{franjas.map((fr) => <option key={fr.clave} value={fr.clave}>{fr.nombre} ({fr.desde}–{fr.hasta})</option>)}</select>
              </Campo>
              <Campo etiqueta="Hora puntual (opcional)"><input className="campo" type="time" value={f.hora_entrega} onChange={(e) => set('hora_entrega', e.target.value)} /></Campo>
            </div>
            <div className="flex gap-2 mt-2">
              {[['Hoy', hoy()], ['Mañana', sumarDias(hoy(), 1)], ['Pasado mañana', sumarDias(hoy(), 2)]].map(([t, v]) => (
                <button key={v} type="button" onClick={() => set('fecha_entrega', v)} className={`insignia cursor-pointer ${f.fecha_entrega === v ? 'bg-rosa-500 text-white' : 'bg-rosa-100 text-rosa-700'}`}>{t}</button>
              ))}
              <label className="insignia bg-red-50 text-red-700 cursor-pointer ml-auto"><input type="checkbox" checked={f.urgente} onChange={(e) => set('urgente', e.target.checked)} className="accent-red-600" /> Urgente</label>
            </div>
            {f.tipo_entrega === 'domicilio' ? (
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <Campo etiqueta="Barrio / zona" clase="relative">
                  <input className="campo" placeholder="Escriba el barrio…" value={buscaZona} onChange={(e) => { setBuscaZona(e.target.value); set('zona_id', ''); set('zona_nombre', e.target.value); }} />
                  {zonasFiltradas.length && !f.zona_id ? (
                    <div className="absolute z-20 left-0 right-0 mt-1 tarjeta divide-y divide-rosa-50 max-h-56 overflow-y-auto">
                      {zonasFiltradas.map((z) => (
                        <button key={z.id} type="button" onClick={() => { setBuscaZona(z.zona); set('zona_id', String(z.id)); set('zona_nombre', z.zona); set('domicilio_valor', ''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-rosa-50 cursor-pointer flex justify-between">
                          <span>{z.zona}</span><b className="text-rosa-600">{z.precio == null ? 'sin tarifa' : pesos(z.precio)}</b>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </Campo>
                <Campo etiqueta="Valor del domicilio" ayuda={zona ? `Tarifa de ${zona.zona}: ${pesos(zona.precio)}` : 'Se llena solo al elegir la zona; se puede cambiar'}>
                  <input className="campo" inputMode="numeric" value={f.domicilio_valor !== '' ? f.domicilio_valor : (zona?.precio ?? '')} onChange={(e) => set('domicilio_valor', e.target.value)} />
                </Campo>
                <Campo etiqueta={esFunebre ? 'Funeraria / dirección' : 'Dirección'} clase="sm:col-span-2"><input className="campo" value={f.direccion} onChange={(e) => set('direccion', e.target.value)} /></Campo>
                <Campo etiqueta="Punto de referencia" clase="sm:col-span-2"><input className="campo" value={f.punto_referencia} onChange={(e) => set('punto_referencia', e.target.value)} /></Campo>
              </div>
            ) : null}
          </Seccion>

          {/* 4. Destinatario y tarjeta */}
          <Seccion n={4} titulo="Para quién y la tarjeta">
            <div className="grid sm:grid-cols-2 gap-3">
              <Campo etiqueta="Ocasión" clase="sm:col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {config?.ocasiones.map((o) => <button key={o.clave} type="button" onClick={() => set('ocasion', f.ocasion === o.clave ? '' : o.clave)} className={`insignia cursor-pointer py-1.5 ${f.ocasion === o.clave ? 'bg-rosa-500 text-white' : 'bg-rosa-50 text-tinta/70 border border-rosa-100'}`}>{o.nombre}</button>)}
                </div>
              </Campo>
              {esFunebre ? (<>
                <Campo etiqueta="Nombre del fallecido"><input className="campo" value={f.fallecido} onChange={(e) => set('fallecido', e.target.value)} /></Campo>
                <div className="grid grid-cols-2 gap-2">
                  <Campo etiqueta="Funeraria"><input className="campo" value={f.funeraria} onChange={(e) => set('funeraria', e.target.value)} placeholder="Jardines, Los Olivos…" /></Campo>
                  <Campo etiqueta="Sala"><input className="campo" value={f.sala} onChange={(e) => set('sala', e.target.value)} /></Campo>
                </div>
              </>) : (<>
                <Campo etiqueta="Quién recibe"><input className="campo" value={f.recibe_nombre} onChange={(e) => set('recibe_nombre', e.target.value)} /></Campo>
                <Campo etiqueta="Teléfono de quien recibe"><input className="campo" inputMode="tel" value={f.recibe_telefono} onChange={(e) => set('recibe_telefono', e.target.value)} /></Campo>
              </>)}
              <Campo etiqueta="Tarjeta · Para:"><input className="campo" value={f.tarjeta_para} onChange={(e) => set('tarjeta_para', e.target.value)} /></Campo>
              <Campo etiqueta="Tarjeta · De: (firma)"><input className="campo" value={f.tarjeta_de} onChange={(e) => set('tarjeta_de', e.target.value)} /></Campo>
              <Campo etiqueta="Mensaje de la tarjeta" clase="sm:col-span-2"><textarea className="campo" rows={3} value={f.tarjeta_mensaje} onChange={(e) => set('tarjeta_mensaje', e.target.value)} /></Campo>
              <Campo etiqueta="Especificaciones del arreglo" clase="sm:col-span-2" ayuda="Colores, cambios, adicionales, foto de referencia (enlace)…"><textarea className="campo" rows={2} value={f.especificaciones} onChange={(e) => set('especificaciones', e.target.value)} /></Campo>
              <Campo etiqueta="Notas internas (no las ve el cliente)" clase="sm:col-span-2"><input className="campo" value={f.notas_internas} onChange={(e) => set('notas_internas', e.target.value)} /></Campo>
            </div>
          </Seccion>
        </div>

        {/* Resumen y pago */}
        <div className="lg:col-span-2">
          <div className="tarjeta p-4 lg:sticky lg:top-6 space-y-4">
            <h2 className="font-bold">Resumen</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-tinta/60">Productos ({items.reduce((s, i) => s + i.cantidad, 0)})</span><span>{pesos(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-tinta/60">Domicilio</span><span>{pesos(domicilio)}</span></div>
              <div className="flex justify-between items-center"><span className="text-tinta/60">Descuento</span><input className="campo w-28 py-1 text-right" inputMode="numeric" placeholder="0" value={f.descuento} onChange={(e) => set('descuento', e.target.value)} /></div>
              <div className="flex justify-between items-center"><span className="text-tinta/60">Recargo {recargoPct ? `${recargoPct}%` : ''}</span><span>{pesos(recargo)}</span></div>
              <div className="flex justify-between text-lg font-extrabold border-t border-rosa-100 pt-2"><span>Total</span><span className="text-rosa-600">{pesos(total)}</span></div>
            </div>
            <Campo etiqueta="Medio de pago previsto" ayuda={medio?.recargo ? `Tarjeta y PayPal llevan ${medio.recargo}% adicional` : ''}>
              <select className="campo" value={f.medio_pago_previsto} onChange={(e) => { set('medio_pago_previsto', e.target.value); set('recargo_pct', ''); }}>
                <option value="">Sin definir</option>{config?.medios_pago.map((m) => <option key={m.clave} value={m.clave}>{m.nombre}{m.recargo ? ` (+${m.recargo}%)` : ''}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Recargo manual %"><input className="campo" inputMode="numeric" placeholder={String(medio?.recargo || 0)} value={f.recargo_pct} onChange={(e) => set('recargo_pct', e.target.value)} /></Campo>
            {!id ? (
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-rosa-500 size-4" checked={f.estado_inicial === 'confirmado'} onChange={(e) => set('estado_inicial', e.target.checked ? 'confirmado' : 'nuevo')} /> Crear ya confirmado</label>
            ) : null}
            <button onClick={guardar} disabled={guardando} className="boton-primario w-full py-3 text-base">{guardando ? 'Guardando…' : id ? 'Guardar cambios' : 'Crear pedido'}</button>
            <p className="text-[11px] text-tinta/50 text-center">El pago se registra después, desde el detalle del pedido.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Seccion({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="tarjeta p-4">
      <h2 className="font-bold mb-3 flex items-center gap-2"><span className="size-6 rounded-full bg-rosa-500 text-white text-xs flex items-center justify-center">{n}</span>{titulo}</h2>
      {children}
    </section>
  );
}
