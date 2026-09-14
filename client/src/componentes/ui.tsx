import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';

// --- Toasts ---------------------------------------------------------------------
type Toast = { id: number; texto: string; tipo: 'ok' | 'error' | 'info' };
const ToastCtx = createContext<{ avisar: (texto: string, tipo?: Toast['tipo']) => void }>({ avisar: () => {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProveedor({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);
  const avisar = useCallback((texto: string, tipo: Toast['tipo'] = 'ok') => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), tipo === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={{ avisar }}>
      {children}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(92vw,420px)] no-imprimir">
        {lista.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg border ${t.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' : t.tipo === 'info' ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// --- Modal ----------------------------------------------------------------------
export function Modal({ abierto, cerrar, titulo, children, ancho = 'max-w-lg' }: { abierto: boolean; cerrar: () => void; titulo: string; children: ReactNode; ancho?: string }) {
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [abierto, cerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-tinta/40 backdrop-blur-[2px] no-imprimir" onClick={cerrar}>
      <div className={`bg-white w-full ${ancho} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-rosa-100 px-5 py-3.5 flex items-center justify-between rounded-t-3xl">
          <h3 className="font-bold text-base">{titulo}</h3>
          <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-rosa-100 cursor-pointer" aria-label="Cerrar"><X className="size-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <div className="py-16 text-center text-sm text-tinta/50 animate-pulse">{texto}</div>;
}
export function Vacio({ texto, hijo }: { texto: string; hijo?: ReactNode }) {
  return (
    <div className="py-12 text-center text-sm text-tinta/50 space-y-3">
      <div className="text-4xl">🌸</div>
      <p>{texto}</p>
      {hijo}
    </div>
  );
}
export function Insignia({ children, clase = 'bg-rosa-100 text-rosa-700' }: { children: ReactNode; clase?: string }) {
  return <span className={`insignia ${clase}`}>{children}</span>;
}
export function Campo({ etiqueta, children, ayuda, clase = '' }: { etiqueta: string; children: ReactNode; ayuda?: string; clase?: string }) {
  return (
    <label className={`block ${clase}`}>
      <span className="etiqueta">{etiqueta}</span>
      {children}
      {ayuda ? <span className="block text-[11px] text-tinta/50 mt-1">{ayuda}</span> : null}
    </label>
  );
}
export function Encabezado({ titulo, sub, acciones }: { titulo: string; sub?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-tinta">{titulo}</h1>
        {sub ? <div className="text-sm text-tinta/60 mt-0.5">{sub}</div> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2 no-imprimir">{acciones}</div> : null}
    </div>
  );
}
export function SelectorFecha({ valor, onChange, hoyTexto = 'Hoy' }: { valor: string; onChange: (f: string) => void; hoyTexto?: string }) {
  const mover = (d: number) => { const x = new Date(`${valor}T12:00:00`); x.setDate(x.getDate() + d); onChange(x.toISOString().slice(0, 10)); };
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(new Date());
  return (
    <div className="flex items-center gap-1 bg-white rounded-xl border border-rosa-200 p-1">
      <button className="px-2.5 py-1.5 rounded-lg hover:bg-rosa-100 cursor-pointer" onClick={() => mover(-1)} aria-label="Día anterior">‹</button>
      <input type="date" value={valor} onChange={(e) => e.target.value && onChange(e.target.value)} className="text-sm font-semibold bg-transparent px-1 focus:outline-none" />
      <button className="px-2.5 py-1.5 rounded-lg hover:bg-rosa-100 cursor-pointer" onClick={() => mover(1)} aria-label="Día siguiente">›</button>
      {valor !== hoy ? <button className="text-xs font-semibold text-rosa-600 px-2 cursor-pointer" onClick={() => onChange(hoy)}>{hoyTexto}</button> : null}
    </div>
  );
}
export function Stat({ etiqueta, valor, sub, clase = '' }: { etiqueta: string; valor: ReactNode; sub?: ReactNode; clase?: string }) {
  return (
    <div className={`tarjeta p-4 ${clase}`}>
      <p className="text-xs font-semibold text-tinta/50 uppercase tracking-wide">{etiqueta}</p>
      <p className="text-2xl font-extrabold mt-1 tracking-tight">{valor}</p>
      {sub ? <p className="text-xs text-tinta/60 mt-0.5">{sub}</p> : null}
    </div>
  );
}

// --- Selector (desplegable propio, con detalle por opción) --------------------------
export type Opcion = { valor: string; nombre: string; detalle?: string; icono?: ReactNode };
export function Selector({ valor, opciones, onChange, placeholder = 'Elegir…', clase = '' }: { valor: string; opciones: Opcion[]; onChange: (v: string) => void; placeholder?: string; clase?: string }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', h); window.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('keydown', k); };
  }, [abierto]);
  const actual = opciones.find((o) => o.valor === valor);
  return (
    <div ref={ref} className={`relative ${clase}`}>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-haspopup="listbox" aria-expanded={abierto}
        className={`campo flex items-center justify-between gap-2 text-left cursor-pointer ${abierto ? 'ring-2 ring-rosa-300 border-rosa-400' : ''}`}>
        <span className="flex items-center gap-2 min-w-0">{actual?.icono}<span className={`truncate ${actual ? '' : 'text-tinta/40'}`}>{actual?.nombre || placeholder}</span></span>
        <ChevronDown className={`size-4 text-tinta/50 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto ? (
        <ul role="listbox" className="absolute z-30 mt-1 left-0 right-0 tarjeta shadow-xl max-h-72 overflow-y-auto py-1">
          {opciones.map((o) => (
            <li key={o.valor} role="option" aria-selected={o.valor === valor} onClick={() => { onChange(o.valor); setAbierto(false); }}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-rosa-50 ${o.valor === valor ? 'bg-rosa-50' : ''}`}>
              {o.icono ? <span className="shrink-0">{o.icono}</span> : null}
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{o.nombre}</span>{o.detalle ? <span className="block text-[11px] text-tinta/50 truncate">{o.detalle}</span> : null}</span>
              {o.valor === valor ? <Check className="size-4 text-rosa-500 shrink-0" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// --- Buscador de zona/barrio (autocompleta con la tarifa) ---------------------------
export function CampoZona({ zonas, valor, zonaId, onChange, placeholder = 'Escriba el barrio…' }: {
  zonas: { id: number; zona: string; precio: number | null }[]; valor: string; zonaId: string;
  onChange: (d: { zona_id: string; zona_nombre: string; precio: number | null }) => void; placeholder?: string;
}) {
  const [foco, setFoco] = useState(false);
  const q = valor.trim().toLowerCase();
  const lista = q.length < 2 || zonaId ? [] : zonas.filter((z) => z.zona.toLowerCase().includes(q)).slice(0, 8);
  return (
    <div className="relative">
      <input className="campo" placeholder={placeholder} value={valor} onFocus={() => setFoco(true)} onBlur={() => setTimeout(() => setFoco(false), 150)}
        onChange={(e) => onChange({ zona_id: '', zona_nombre: e.target.value, precio: null })} />
      {foco && lista.length ? (
        <div className="absolute z-20 left-0 right-0 mt-1 tarjeta divide-y divide-rosa-50 max-h-56 overflow-y-auto shadow-xl">
          {lista.map((z) => (
            <button key={z.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ zona_id: String(z.id), zona_nombre: z.zona, precio: z.precio }); setFoco(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-rosa-50 cursor-pointer flex justify-between">
              <span>{z.zona}</span><b className="text-rosa-600">{z.precio == null ? 'sin tarifa' : '$' + z.precio.toLocaleString('es-CO')}</b>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
