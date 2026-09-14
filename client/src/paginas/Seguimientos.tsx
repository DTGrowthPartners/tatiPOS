import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Seguimiento } from '../api';
import { useSesion } from '../App';
import { Cargando, Encabezado, Insignia, useToast } from '../componentes/ui';
import { fechaHora, telefonoBonito } from '../lib/formato';
import { SEGUIMIENTO } from '../lib/estados';

export default function Seguimientos() {
  const { config, esAdmin } = useSesion();
  const { avisar } = useToast();
  const [estado, setEstado] = useState('');
  const [lista, setLista] = useState<Seguimiento[] | null>(null);
  const cargar = () => api.seguimientos(estado).then(setLista);
  useEffect(() => { setLista(null); cargar(); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps
  const clase: Record<string, string> = { pendiente: 'bg-amber-100 text-amber-800', enviado: 'bg-green-100 text-green-800', fallido: 'bg-red-100 text-red-700', cancelado: 'bg-gray-100 text-gray-600' };
  return (
    <div>
      <Encabezado titulo="Mensajes automáticos" sub={config?.seguimientos.activo ? 'Activos: salen solos desde el WhatsApp de la floristería' : <span className="text-amber-700">Desactivados: se programan pero no se envían hasta activarlos en Configuración</span>}
        acciones={esAdmin ? <Link to="/configuracion?tab=mensajes" className="boton-secundario">Configurar</Link> : null} />
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['', 'Todos'], ['pendiente', 'Pendientes'], ['enviado', 'Enviados'], ['fallido', 'Fallidos'], ['cancelado', 'Cancelados']].map(([k, t]) => <button key={k} onClick={() => setEstado(k)} className={`insignia py-1.5 px-3 text-sm cursor-pointer ${estado === k ? 'bg-rosa-500 text-white' : 'bg-white border border-rosa-200'}`}>{t}</button>)}
      </div>
      {!lista ? <Cargando /> : !lista.length ? <p className="text-sm text-tinta/50 text-center py-10">Nada por aquí</p> : (
        <div className="space-y-2">
          {lista.map((s) => (
            <div key={s.id} className="tarjeta p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <b>{SEGUIMIENTO[s.tipo] || s.tipo}</b>
                {s.pedido_id ? <Link to={`/pedidos/${s.pedido_id}`} className="font-mono font-bold text-rosa-600">{s.codigo}</Link> : null}
                <span className="text-tinta/60">{s.cliente_nombre || telefonoBonito(s.telefono)}</span>
                <Insignia clase={clase[s.estado]}>{s.estado}</Insignia>
                <span className="text-tinta/50 ml-auto">{s.estado === 'enviado' ? fechaHora(s.enviado_en) : fechaHora(s.programado_para)}</span>
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{s.mensaje}</p>
              {s.error ? <p className="text-xs text-red-600 mt-1">{s.error}</p> : null}
              <div className="flex gap-3 mt-1.5 text-xs">
                {s.estado === 'fallido' ? <button className="text-rosa-600 font-semibold cursor-pointer" onClick={() => api.reintentarSeg(s.id).then(cargar)}>Reintentar</button> : null}
                {s.estado === 'pendiente' ? <button className="text-red-600 cursor-pointer" onClick={() => api.cancelarSeg(s.id).then(cargar)}>No enviar</button> : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {esAdmin ? <button className="boton-fantasma mt-4 text-xs" onClick={() => api.procesarSeguimientos().then((r) => { avisar(`Procesado · ${r.recompras_programadas} recordatorios de recompra programados`); cargar(); })}>Procesar cola ahora</button> : null}
    </div>
  );
}
