import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Camera } from 'lucide-react';
import { api, type Producto } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, Modal, Campo, useToast } from '../componentes/ui';
import { pesos } from '../lib/formato';

export default function Catalogo() {
  const { esAdmin } = useSesion();
  const { avisar } = useToast();
  const [lista, setLista] = useState<Producto[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [edit, setEdit] = useState<Partial<Producto> | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const cargar = () => api.productos(esAdmin).then(setLista);
  useEffect(() => { cargar(); }, [esAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  const categorias = useMemo(() => { const s = new Set<string>(); (lista || []).forEach((p) => String(p.categoria || '').split(',').forEach((c) => c.trim() && s.add(c.trim()))); return [...s].sort(); }, [lista]);
  const filtrados = useMemo(() => { const t = q.trim().toLowerCase(); return (lista || []).filter((p) => (!cat || String(p.categoria || '').includes(cat)) && (!t || p.nombre.toLowerCase().includes(t) || p.id.toLowerCase().includes(t))); }, [lista, q, cat]);

  async function guardar() {
    if (!edit) return;
    try {
      const p = edit.id && lista?.some((x) => x.id === edit.id) ? await api.editarProducto(edit.id, edit) : await api.crearProducto(edit);
      if (foto) await api.fotoProducto(p.id, foto);
      avisar('Producto guardado'); setEdit(null); setFoto(null); cargar();
    } catch (e) { avisar((e as Error).message, 'error'); }
  }

  return (
    <div>
      <Encabezado titulo="Catálogo" sub={lista ? `${lista.filter((p) => p.activo).length} productos activos` : ''} acciones={esAdmin ? <button onClick={() => { setEdit({ nombre: '', precio: 0, categoria: '', activo: 1 }); setFoto(null); }} className="boton-primario"><Plus className="size-4" /> Producto</button> : null} />
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1"><Search className="size-4 absolute left-3 top-3 text-tinta/40" /><input className="campo pl-9" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="campo w-auto max-w-[45%]" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas las categorías</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {!lista ? <Cargando /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtrados.map((p) => (
            <div key={p.id} onClick={() => esAdmin && (setEdit(p), setFoto(null))} className={`tarjeta overflow-hidden ${esAdmin ? 'cursor-pointer hover:border-rosa-400' : ''} ${!p.activo ? 'opacity-50' : ''}`}>
              <div className="aspect-square bg-rosa-50 relative">
                {p.imagen ? <img src={`/fotos/${p.imagen}`} alt={p.nombre} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-4xl">🌷</div>}
                {p.precio_antes ? <span className="absolute top-1.5 left-1.5 insignia bg-rosa-500 text-white">Promo</span> : null}
                {!p.activo ? <span className="absolute top-1.5 right-1.5 insignia bg-gray-700 text-white">Oculto</span> : null}
              </div>
              <div className="p-2">
                <p className="text-xs font-semibold leading-tight line-clamp-2">{p.nombre}</p>
                <p className="text-sm font-bold text-rosa-600 mt-0.5">{pesos(p.precio)} {p.precio_antes ? <s className="text-[11px] text-tinta/40 font-normal">{pesos(p.precio_antes)}</s> : null}</p>
                <p className="text-[10px] text-tinta/50 truncate">{p.categoria}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal abierto={Boolean(edit)} cerrar={() => setEdit(null)} titulo={edit?.id && lista?.some((x) => x.id === edit.id) ? `Editar ${edit.id}` : 'Nuevo producto'}>
        {edit ? (
          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <div className="size-24 rounded-xl bg-rosa-50 overflow-hidden shrink-0">{foto ? <img src={URL.createObjectURL(foto)} className="w-full h-full object-cover" alt="" /> : edit.imagen ? <img src={`/fotos/${edit.imagen}`} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🌷</div>}</div>
              <label className="boton-secundario cursor-pointer"><Camera className="size-4" /> {foto ? foto.name : 'Cambiar foto'}<input type="file" accept="image/*" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] || null)} /></label>
            </div>
            <Campo etiqueta="Nombre"><input className="campo" value={edit.nombre || ''} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Precio"><input className="campo" inputMode="numeric" value={edit.precio ?? ''} onChange={(e) => setEdit({ ...edit, precio: Number(e.target.value) || 0 })} /></Campo>
              <Campo etiqueta="Precio anterior (promo)"><input className="campo" inputMode="numeric" value={edit.precio_antes ?? ''} onChange={(e) => setEdit({ ...edit, precio_antes: e.target.value ? Number(e.target.value) : null })} /></Campo>
            </div>
            <Campo etiqueta="Categoría" ayuda="Varias separadas por coma"><input className="campo" list="cats" value={edit.categoria || ''} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} /><datalist id="cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist></Campo>
            <Campo etiqueta="Descripción / nota"><textarea className="campo" rows={2} value={edit.descripcion || ''} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></Campo>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="accent-rosa-500 size-4" checked={Boolean(edit.activo)} onChange={(e) => setEdit({ ...edit, activo: e.target.checked ? 1 : 0 })} /> Visible para vender</label>
            <button onClick={guardar} className="boton-primario w-full py-3">Guardar</button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
