import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api, type Usuario, type Config } from './api';
import { ToastProveedor, Cargando } from './componentes/ui';
import { Layout } from './componentes/Layout';
import Login from './paginas/Login';
import Inicio from './paginas/Inicio';
import Pedidos from './paginas/Pedidos';
import PedidoForm from './paginas/PedidoForm';
import PedidoDetalle from './paginas/PedidoDetalle';
import Guia from './paginas/Guia';
import Agenda from './paginas/Agenda';
import Produccion from './paginas/Produccion';
import Entregas from './paginas/Entregas';
import Clientes from './paginas/Clientes';
import ClienteDetalle from './paginas/ClienteDetalle';
import Catalogo from './paginas/Catalogo';
import Reportes from './paginas/Reportes';
import Caja from './paginas/Caja';
import Configuracion from './paginas/Configuracion';
import Seguimientos from './paginas/Seguimientos';
import MisEntregas from './paginas/MisEntregas';

type Sesion = { usuario: Usuario | null; config: Config | null; recargarConfig: () => Promise<void>; salir: () => Promise<void>; esAdmin: boolean };
const SesionCtx = createContext<Sesion>({ usuario: null, config: null, recargarConfig: async () => {}, salir: async () => {}, esAdmin: false });
export const useSesion = () => useContext(SesionCtx);

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [config, setConfig] = useState<Config | null>(null);
  const loc = useLocation();

  const recargarConfig = useCallback(async () => { setConfig(await api.config()); }, []);

  useEffect(() => {
    api.auth.sesion().then((s) => setUsuario(s.usuario)).catch(() => setUsuario(null));
    const h = () => setUsuario(null);
    window.addEventListener('sesion-vencida', h);
    return () => window.removeEventListener('sesion-vencida', h);
  }, []);
  useEffect(() => { if (usuario) recargarConfig().catch(() => {}); }, [usuario, recargarConfig]);

  const salir = useCallback(async () => { await api.auth.logout().catch(() => {}); setUsuario(null); }, []);

  if (usuario === undefined) return <Cargando texto="Abriendo TatiPOS…" />;
  if (!usuario) return <ToastProveedor><Login alEntrar={setUsuario} /></ToastProveedor>;
  if (!config) return <Cargando />;

  const valor: Sesion = { usuario, config, recargarConfig, salir, esAdmin: usuario.rol === 'admin' };
  const soloAdmin = (el: React.ReactElement) => (usuario.rol === 'admin' ? el : <Navigate to="/" replace />);

  if (usuario.rol === 'domiciliario') {
    return (
      <SesionCtx.Provider value={valor}>
        <ToastProveedor>
          <Routes>
            <Route path="/pedidos/:id/guia" element={<Guia />} />
            <Route path="*" element={<MisEntregas />} />
          </Routes>
        </ToastProveedor>
      </SesionCtx.Provider>
    );
  }

  return (
    <SesionCtx.Provider value={valor}>
      <ToastProveedor>
        <Routes>
          <Route path="/pedidos/:id/guia" element={<Guia />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/pedidos/nuevo" element={<PedidoForm key={loc.key} />} />
            <Route path="/pedidos/:id" element={<PedidoDetalle />} />
            <Route path="/pedidos/:id/editar" element={<PedidoForm />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/produccion" element={<Produccion />} />
            <Route path="/entregas" element={<Entregas />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalle />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/seguimientos" element={<Seguimientos />} />
            <Route path="/caja" element={<Caja />} />
            <Route path="/reportes" element={soloAdmin(<Reportes />)} />
            <Route path="/configuracion" element={soloAdmin(<Configuracion />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProveedor>
    </SesionCtx.Provider>
  );
}
