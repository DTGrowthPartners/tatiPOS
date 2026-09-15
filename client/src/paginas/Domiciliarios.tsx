import { useEffect, useState } from 'react';
import { Plus, Bike, Pencil, MessageCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { api, type Domiciliario } from '../api';
import { Cargando, Encabezado, Vacio, Modal, Campo, Insignia, useToast } from '../componentes/ui';
import { telefonoBonito, enlaceWa, iniciales } from '../lib/formato';

type Form = { id?: number; nombre: string; telefono: string; usuario: string; clave: string };

const usuarioSugerido = (nombre: string) => nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 14);
const claveTelefono = (t: string) => { const d = t.replace(/\D/g, ''); return d.length === 12 && d.startsWith('57') ? d.slice(2) : d; };

export default function Domiciliarios() {
  const { avisar } = useToast();
  const [lista, setLista] = useState<Domiciliario[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [verClave, setVerClave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const cargar = () => api.domiciliarios(true).then(setLista);
  useEffect(() => { cargar(); }, []);
  const err = (e: Error) => avisar(e.message, 'error');

  const abrirNuevo = () => { setVerClave(true); setForm({ nombre: '', telefono: '', usuario: '', clave: '' }); };
  const abrirEditar = (d: Domiciliario) => { setVerClave(false); setForm({ id: d.id, nombre: d.nombre, telefono: d.telefono ? claveTelefono(d.telefono) : '', usuario: d.usuario || '', clave: '' }); };

  async function guardar() {
    if (!form) return;
    if (!form.nombre.trim()) return avisar('Falta el nombre', 'error');
    if (!form.telefono.trim()) return avisar('Falta el teléfono', 'error');
    if (!form.usuario.trim()) return avisar('Falta el nombre de usuario', 'error');
    const claveFinal = form.clave || claveTelefono(form.telefono);
    if (claveFinal.length < 6) return avisar('La clave debe tener al menos 6 caracteres', 'error');
    setGuardando(true);
    try {
      if (form.id) {
        await api.editarDomiciliario(form.id, { nombre: form.nombre, telefono: form.telefono, usuario: form.usuario, ...(form.clave ? { clave: form.clave } : {}) });
        avisar('Domiciliario actualizado');
      } else {
        await api.crearDomiciliario({ nombre: form.nombre, telefono: form.telefono, usuario: form.usuario, clave: claveFinal });
        avisar(`Listo: ${form.nombre} entra con @${form.usuario} y clave ${claveFinal}`);
      }
      setForm(null); cargar();
    } catch (e) { err(e as Error); } finally { setGuardando(false); }
  }

  async function claveAlTelefono(d: Domiciliario) {
    if (!d.telefono) return avisar('Ese domiciliario no tiene teléfono', 'error');
    try { await api.editarDomiciliario(d.id, { clave_telefono: true }); avisar(`Clave de ${d.nombre} restablecida a ${claveTelefono(d.telefono)}`); cargar(); } catch (e) { err(e as Error); }
  }

  if (!lista) return <Cargando />;
  const activos = lista.filter((d) => d.activo);
  const inactivos = lista.filter((d) => !d.activo);

  return (
    <div>
      <Encabezado
        titulo="Domiciliarios"
        sub="Cada uno entra a tatipos.dtgp.ai con su usuario y ve solo sus entregas del día: dirección, teléfono, mapa y entregado con foto."
        acciones={<button onClick={abrirNuevo} className="boton-primario"><Plus className="size-4" /> Domiciliario</button>}
      />

      {lista.length === 0 ? (
        <Vacio texto="Todavía no hay domiciliarios" hijo={<button onClick={abrirNuevo} className="boton-primario mt-3"><Plus className="size-4" /> Agregar el primero</button>} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[...activos, ...inactivos].map((d) => (
          <div key={d.id} className={`tarjeta p-4 flex flex-col gap-3 ${!d.activo ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="size-11 rounded-full bg-rosa-100 text-rosa-700 font-bold flex items-center justify-center shrink-0">{iniciales(d.nombre)}</div>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{d.nombre}</p>
                <p className="text-sm text-tinta/70">{d.telefono ? telefonoBonito(d.telefono) : <span className="text-tinta/40">sin teléfono</span>}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {d.usuario ? <Insignia clase="bg-sky-100 text-sky-800">@{d.usuario}</Insignia> : <Insignia clase="bg-amber-100 text-amber-800">sin cuenta</Insignia>}
                  {!d.activo ? <Insignia clase="bg-gray-200 text-gray-700">deshabilitado</Insignia> : null}
                  {d.pendientes ? <Insignia clase="bg-rosa-100 text-rosa-700"><Bike className="size-3" /> {d.pendientes} pendiente{d.pendientes === 1 ? '' : 's'}</Insignia> : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 border-t border-rosa-50">
              <button onClick={() => abrirEditar(d)} className="boton-secundario py-1.5 px-3 text-xs"><Pencil className="size-3.5" /> Editar</button>
              {d.telefono ? <a href={enlaceWa(d.telefono)} target="_blank" rel="noreferrer" className="boton-suave py-1.5 px-3 text-xs"><MessageCircle className="size-3.5" /> WhatsApp</a> : null}
              {d.usuario && d.telefono ? <button onClick={() => claveAlTelefono(d)} className="boton-fantasma py-1.5 px-3 text-xs" title="La clave vuelve a ser su teléfono"><KeyRound className="size-3.5" /> Clave = teléfono</button> : null}
              <button onClick={() => api.editarDomiciliario(d.id, { activo: !d.activo }).then(cargar).catch(err)} className={`py-1.5 px-3 text-xs ml-auto ${d.activo ? 'boton-peligro' : 'boton-primario'}`}>{d.activo ? 'Deshabilitar' : 'Habilitar'}</button>
            </div>
          </div>
        ))}
      </div>

      <Modal abierto={Boolean(form)} cerrar={() => setForm(null)} titulo={form?.id ? `Editar a ${form.nombre || 'domiciliario'}` : 'Nuevo domiciliario'}>
        {form ? (
          <div className="space-y-3">
            <Campo etiqueta="Nombre">
              <input className="campo" value={form.nombre} autoFocus onChange={(e) => setForm({ ...form, nombre: e.target.value, usuario: form.id || form.usuario !== usuarioSugerido(form.nombre) ? form.usuario : usuarioSugerido(e.target.value) })} />
            </Campo>
            <Campo etiqueta="Teléfono (WhatsApp)" ayuda={form.id ? undefined : 'Será también su clave para entrar'}>
              <input className="campo" inputMode="tel" placeholder="300 123 4567" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </Campo>
            <Campo etiqueta="Nombre de usuario" ayuda="Con este entra a tatipos.dtgp.ai">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta/40 text-[15px]">@</span>
                <input className="campo pl-8" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase().replace(/\s+/g, '') })} />
              </div>
            </Campo>
            <Campo etiqueta={form.id ? 'Nueva clave' : 'Clave'} ayuda={form.id ? 'Déjela vacía para no cambiarla' : 'Si la deja vacía, la clave será el teléfono'}>
              <div className="relative">
                <input className="campo pr-11" type={verClave ? 'text' : 'password'} autoComplete="new-password" placeholder={form.id ? '••••••' : claveTelefono(form.telefono) || 'el teléfono'} value={form.clave} onChange={(e) => setForm({ ...form, clave: e.target.value })} />
                <button type="button" onClick={() => setVerClave(!verClave)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-tinta/50 hover:bg-rosa-100 cursor-pointer" aria-label={verClave ? 'Ocultar clave' : 'Ver clave'}>{verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
            </Campo>
            <div className="rounded-xl bg-rosa-50 border border-rosa-100 p-3 text-xs text-tinta/70">
              Entra desde el celular a <b>tatipos.dtgp.ai</b> con <b>@{form.usuario || '…'}</b> y clave <b>{form.clave || (form.id ? '(la actual)' : claveTelefono(form.telefono) || 'su teléfono')}</b>.
            </div>
            <button onClick={guardar} disabled={guardando} className="boton-primario w-full py-3">{form.id ? 'Guardar cambios' : 'Crear domiciliario'}</button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
