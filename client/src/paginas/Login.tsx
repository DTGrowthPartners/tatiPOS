import { useState, type FormEvent } from 'react';
import { api, type Usuario } from '../api';

export default function Login({ alEntrar }: { alEntrar: (u: Usuario) => void }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(''); setCargando(true);
    try { const r = await api.auth.login(usuario.trim(), clave); alEntrar(r.usuario); }
    catch (err) { setError((err as Error).message); }
    finally { setCargando(false); }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,#FFE4EF_0%,#FFF5F9_55%,#ffffff_100%)]">
      <form onSubmit={enviar} className="w-full max-w-sm tarjeta p-7 space-y-5">
        <div className="text-center space-y-2">
          <img src="/logo.svg" alt="Floristería Tati Ramos" className="h-16 mx-auto" />
          <p className="text-xs font-bold tracking-[0.3em] text-rosa-500 uppercase">TatiPOS</p>
          <p className="text-sm text-tinta/60">Pedidos, producción, entregas y caja</p>
        </div>
        <label className="block">
          <span className="etiqueta">Usuario</span>
          <input className="campo" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus required />
        </label>
        <label className="block">
          <span className="etiqueta">Clave</span>
          <input className="campo" type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
        </label>
        {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p> : null}
        <button className="boton-primario w-full py-3" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
        <p className="text-[11px] text-center text-tinta/40">Un sistema de DT Growth Partners para Floristería Tati Ramos</p>
      </form>
    </div>
  );
}
