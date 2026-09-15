import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Home, ClipboardList, CalendarDays, Flower2, Truck, Users, BookImage, BarChart3, Wallet, Settings, LogOut, Plus, MoreHorizontal, MessageCircle, X, PanelLeftClose, PanelLeftOpen, Bike } from 'lucide-react';
import { useSesion } from '../App';

const SECCIONES = [
  { a: '/', t: 'Inicio', I: Home },
  { a: '/pedidos', t: 'Pedidos', I: ClipboardList },
  { a: '/agenda', t: 'Agenda', I: CalendarDays },
  { a: '/produccion', t: 'Producción', I: Flower2 },
  { a: '/entregas', t: 'Entregas', I: Truck },
  { a: '/clientes', t: 'Clientes', I: Users },
  { a: '/domiciliarios', t: 'Domiciliarios', I: Bike, admin: true },
  { a: '/catalogo', t: 'Catálogo', I: BookImage },
  { a: '/seguimientos', t: 'Mensajes', I: MessageCircle },
  { a: '/caja', t: 'Caja', I: Wallet },
  { a: '/reportes', t: 'Reportes', I: BarChart3, admin: true },
  { a: '/configuracion', t: 'Configuración', I: Settings, admin: true },
];

export function Layout() {
  const { usuario, salir, esAdmin } = useSesion();
  const nav = useNavigate();
  const loc = useLocation();
  const [mas, setMas] = useState(false);
  const [plegada, setPlegada] = useState(() => { try { return localStorage.getItem('tatipos_sidebar') === 'plegada'; } catch { return false; } });
  const alternar = () => { const v = !plegada; setPlegada(v); try { localStorage.setItem('tatipos_sidebar', v ? 'plegada' : 'abierta'); } catch { /* sin storage */ } };
  const visibles = SECCIONES.filter((s) => !s.admin || esAdmin);
  const clase = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ${plegada ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'} ${isActive ? 'bg-rosa-500 text-white shadow-[0_2px_8px_rgba(232,64,144,0.35)]' : 'text-tinta/70 hover:bg-rosa-100'}`;
  const movil = ['/', '/pedidos', '/agenda', '/produccion'];
  const enMas = !movil.includes(loc.pathname) && !loc.pathname.startsWith('/pedidos');

  return (
    <div className="min-h-dvh md:flex">
      {/* Barra lateral (escritorio) */}
      <aside className={`hidden md:flex md:flex-col shrink-0 bg-white border-r border-rosa-100 sticky top-0 h-dvh no-imprimir transition-[width] duration-200 ${plegada ? 'w-[72px]' : 'w-60'}`}>
        <div className={`border-b border-rosa-100 flex items-center justify-center ${plegada ? 'px-2 py-3' : 'px-4 py-4'}`}>
          <img src="/logo-emblema.png" alt="Floristería Tati Ramos" className={plegada ? 'h-10 w-auto' : 'h-24 w-auto'} />
        </div>
        <nav className={`flex-1 overflow-y-auto space-y-0.5 ${plegada ? 'p-2' : 'p-3'}`}>
          {visibles.map((s) => (
            <NavLink key={s.a} to={s.a} end={s.a === '/'} className={clase} title={s.t}><s.I className="size-[18px] shrink-0" />{!plegada ? s.t : null}</NavLink>
          ))}
        </nav>
        <div className={`border-t border-rosa-100 ${plegada ? 'p-2 space-y-1' : 'p-3'}`}>
          <button onClick={() => nav('/pedidos/nuevo')} className={`boton-primario w-full mb-2 ${plegada ? 'px-0' : ''}`} title="Nuevo pedido"><Plus className="size-4" />{!plegada ? ' Nuevo pedido' : null}</button>
          {plegada ? (
            <div className="flex flex-col items-center gap-1">
              <button onClick={alternar} className="p-2 rounded-lg hover:bg-rosa-100 cursor-pointer" title="Expandir menú"><PanelLeftOpen className="size-4" /></button>
              <button onClick={salir} className="p-2 rounded-lg hover:bg-rosa-100 cursor-pointer" title="Salir"><LogOut className="size-4" /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{usuario?.nombre}</p>
                <p className="text-[11px] text-tinta/50">{esAdmin ? 'Administradora' : 'Equipo'}</p>
              </div>
              <div className="flex">
                <button onClick={alternar} className="p-2 rounded-lg hover:bg-rosa-100 cursor-pointer" title="Plegar menú"><PanelLeftClose className="size-4" /></button>
                <button onClick={salir} className="p-2 rounded-lg hover:bg-rosa-100 cursor-pointer" title="Salir"><LogOut className="size-4" /></button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-rosa-100 px-4 py-2.5 flex items-center justify-between no-imprimir">
          <img src="/logo-emblema.png" alt="Floristería Tati Ramos" className="h-12 w-auto" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-tinta/60">{usuario?.nombre?.split(' ')[0]}</span>
            <button onClick={salir} className="p-2 rounded-lg hover:bg-rosa-100 cursor-pointer" aria-label="Salir"><LogOut className="size-4" /></button>
          </div>
        </header>
        <main className="px-4 py-4 md:px-8 md:py-6 max-w-[1400px] mx-auto pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (móvil) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-rosa-100 grid grid-cols-5 no-imprimir" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {visibles.slice(0, 2).map((s) => <ItemMovil key={s.a} {...s} />)}
        <button onClick={() => nav('/pedidos/nuevo')} className="flex flex-col items-center justify-center py-1.5 cursor-pointer" aria-label="Nuevo pedido">
          <span className="size-11 -mt-5 rounded-full bg-rosa-500 text-white flex items-center justify-center shadow-[0_4px_12px_rgba(232,64,144,0.45)]"><Plus className="size-6" /></span>
          <span className="text-[10px] font-semibold text-rosa-600 mt-0.5">Nuevo</span>
        </button>
        {visibles.slice(2, 4).map((s) => <ItemMovil key={s.a} {...s} />)}
      </nav>
      <button onClick={() => setMas(true)} className={`md:hidden fixed bottom-20 right-4 z-40 size-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer no-imprimir ${enMas ? 'bg-rosa-500 text-white' : 'bg-white text-rosa-600 border border-rosa-200'}`} aria-label="Más secciones">
        <MoreHorizontal className="size-6" />
      </button>
      {mas ? (
        <div className="md:hidden fixed inset-0 z-50 bg-tinta/40 flex items-end no-imprimir" onClick={() => setMas(false)}>
          <div className="bg-white w-full rounded-t-3xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><p className="font-bold">Secciones</p><button onClick={() => setMas(false)} className="p-1.5 cursor-pointer"><X className="size-5" /></button></div>
            <div className="grid grid-cols-3 gap-2">
              {visibles.slice(4).map((s) => (
                <NavLink key={s.a} to={s.a} onClick={() => setMas(false)} className={({ isActive }) => `flex flex-col items-center gap-1.5 p-3 rounded-2xl text-xs font-semibold ${isActive ? 'bg-rosa-500 text-white' : 'bg-rosa-50 text-tinta/80'}`}>
                  <s.I className="size-6" />{s.t}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ItemMovil({ a, t, I }: { a: string; t: string; I: React.ComponentType<{ className?: string }> }) {
  return (
    <NavLink to={a} end={a === '/'} className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? 'text-rosa-600' : 'text-tinta/50'}`}>
      <I className="size-5" />{t}
    </NavLink>
  );
}
