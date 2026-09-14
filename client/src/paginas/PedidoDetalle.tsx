import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Printer, MessageCircle, Camera, Phone, MapPin, CreditCard, Truck, Flower2, XCircle, Send } from 'lucide-react';
import { api, type Pedido, type Domiciliario } from '../api';
import { useSesion } from '../App';
import { Cargando, Insignia, Modal, Campo, Selector, useToast } from '../componentes/ui';
import { ICONO_MEDIO } from './PedidoForm';
import { pesos, fechaLarga, fechaHora, telefonoBonito, enlaceWa, hoy } from '../lib/formato';
import { ESTADO, PAGO, SEGUIMIENTO, type Estado } from '../lib/estados';

export default function PedidoDetalle() {
  const { id } = useParams();
  const { config, esAdmin } = useSesion();
  const { avisar } = useToast();
  const [p, setP] = useState<Pedido | null>(null);
  const [domiciliarios, setDomiciliarios] = useState<Domiciliario[]>([]);
  const [preparadores, setPreparadores] = useState<{ id: number; nombre: string }[]>([]);
  const [modal, setModal] = useState<'' | 'pago' | 'cancelar' | 'evidencia' | 'mensaje' | 'asignar'>('');
  const [pago, setPago] = useState({ medio: '', monto: '', nota: '', comprobante: null as File | null });
  const [motivo, setMotivo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const cargar = () => api.pedido(Number(id)).then(setP);
  useEffect(() => { cargar(); api.domiciliarios().then(setDomiciliarios); api.produccion().then((r) => setPreparadores(r.preparadores)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <Cargando />;
  const est = ESTADO[p.estado as Estado];
  const franja = config?.franjas.find((f) => f.clave === p.franja);
  const medioNombre = (c: string) => config?.medios_pago.find((m) => m.clave === c)?.nombre || c;
  const pendiente = Math.max(0, p.total - p.pagado);

  async function accion(fn: () => Promise<Pedido | unknown>, ok: string) {
    setOcupado(true);
    try { const r = await fn(); if (r && typeof r === 'object' && 'codigo' in (r as Pedido)) setP(r as Pedido); else await cargar(); avisar(ok); setModal(''); }
    catch (e) { avisar((e as Error).message, 'error'); }
    finally { setOcupado(false); }
  }

  const textoWa = `Hola${p.cliente_nombre ? ' ' + p.cliente_nombre.split(' ')[0] : ''} 🌸 le escribimos de Floristería Tati Ramos por su pedido ${p.codigo}.`;

  return (
    <div className="max-w-5xl space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold font-mono text-rosa-600">{p.codigo}</h1>
            <Insignia clase={est.clase}>{est.nombre}</Insignia>
            <Insignia clase={PAGO[p.estado_pago].clase}>{PAGO[p.estado_pago].nombre}</Insignia>
            {p.urgente ? <Insignia clase="bg-red-100 text-red-700">Urgente</Insignia> : null}
            {p.origen === 'bot' ? <Insignia clase="bg-emerald-100 text-emerald-800">🤖 Agente WhatsApp</Insignia> : null}
          </div>
          <p className="text-sm text-tinta/60 mt-1 first-letter:uppercase">{fechaLarga(p.fecha_entrega)}{franja ? ` · ${franja.nombre} ${franja.desde}–${franja.hasta}` : ''}{p.hora_entrega ? ` · ${p.hora_entrega}` : ''} · {p.tipo_entrega === 'recoge' ? 'recoge en tienda' : 'domicilio'}</p>
        </div>
        <div className="flex flex-wrap gap-2 no-imprimir">
          <Link to={`/pedidos/${p.id}/guia`} className="boton-secundario"><Printer className="size-4" /> Guía</Link>
          {p.estado !== 'entregado' || esAdmin ? <Link to={`/pedidos/${p.id}/editar`} className="boton-secundario"><Pencil className="size-4" /> Editar</Link> : null}
          <button onClick={() => { setMensaje(''); setModal('mensaje'); }} className="boton-secundario"><MessageCircle className="size-4" /> Mensaje</button>
        </div>
      </div>

      {/* Acción principal */}
      {p.estado !== 'entregado' && p.estado !== 'cancelado' ? (
        <div className="tarjeta p-3 flex flex-wrap items-center gap-2 no-imprimir">
          {est.siguiente ? (
            <button disabled={ocupado} onClick={() => {
              if (est.siguiente === 'entregado') { setFoto(null); setModal('evidencia'); return; }
              accion(() => api.cambiarEstado(p.id, est.siguiente!), `Pedido ${ESTADO[est.siguiente!].nombre.toLowerCase()}`);
            }} className="boton-primario flex-1 sm:flex-none py-3">{est.accion} →</button>
          ) : null}
          {p.estado === 'nuevo' || p.estado === 'confirmado' ? null : (
            <select className="campo w-auto" value="" onChange={(e) => e.target.value && accion(() => api.cambiarEstado(p.id, e.target.value), 'Estado cambiado')}>
              <option value="">Cambiar a…</option>
              {(['confirmado', 'preparacion', 'listo', 'en_ruta'] as Estado[]).filter((e) => e !== p.estado).map((e) => <option key={e} value={e}>{ESTADO[e].nombre}</option>)}
            </select>
          )}
          <button onClick={() => setModal('asignar')} className="boton-secundario"><Truck className="size-4" /> Asignar</button>
          {pendiente > 0 ? <button onClick={() => { setPago({ medio: config?.medios_pago[0]?.clave || 'efectivo', monto: String(pendiente), nota: '', comprobante: null }); setModal('pago'); }} className="boton-suave"><CreditCard className="size-4" /> Registrar pago {pesos(pendiente)}</button> : null}
          <button onClick={() => { setMotivo(''); setModal('cancelar'); }} className="boton-fantasma text-red-600 ml-auto"><XCircle className="size-4" /> Cancelar</button>
        </div>
      ) : p.estado === 'cancelado' ? (
        <div className="tarjeta p-3 bg-gray-50 text-sm">Cancelado{p.cancelado_motivo ? `: ${p.cancelado_motivo}` : ''}. {esAdmin ? <button className="text-rosa-600 font-semibold cursor-pointer" onClick={() => accion(() => api.cambiarEstado(p.id, 'confirmado'), 'Pedido reabierto')}>Reabrir</button> : null}</div>
      ) : (
        <div className="tarjeta p-3 bg-green-50 text-sm flex flex-wrap items-center gap-3">
          <span>✅ Entregado a las {p.hora_entregado}{p.domiciliario_nombre ? ` por ${p.domiciliario_nombre}` : ''}.</span>
          {p.evidencia_foto ? <a href={`/uploads/${p.evidencia_foto}`} target="_blank" rel="noreferrer" className="text-rosa-600 font-semibold">Ver foto</a> : <button onClick={() => { setFoto(null); setModal('evidencia'); }} className="text-rosa-600 font-semibold cursor-pointer">Subir foto de evidencia</button>}
          {pendiente > 0 ? <button onClick={() => { setPago({ medio: 'efectivo', monto: String(pendiente), nota: '', comprobante: null }); setModal('pago'); }} className="boton-suave py-1.5 ml-auto">Registrar pago {pesos(pendiente)}</button> : null}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Productos */}
          <Bloque titulo="Arreglo" icono={<Flower2 className="size-4" />}>
            <div className="divide-y divide-rosa-50">
              {p.items?.map((it) => (
                <div key={it.id} className="py-2 flex items-center gap-3">
                  {it.imagen ? <img src={`/fotos/${it.imagen}`} alt="" className="size-14 rounded-xl object-cover" /> : <div className="size-14 rounded-xl bg-rosa-50 flex items-center justify-center text-2xl">🌷</div>}
                  <div className="flex-1 min-w-0"><p className="font-semibold text-sm">{it.cantidad} × {it.nombre}</p>{it.nota ? <p className="text-xs text-tinta/60">{it.nota}</p> : null}</div>
                  <p className="font-semibold text-sm">{pesos(it.cantidad * it.precio)}</p>
                </div>
              ))}
            </div>
            {p.especificaciones ? <p className="mt-2 text-sm bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">✨ {p.especificaciones}</p> : null}
            <div className="mt-3 text-sm space-y-1 border-t border-rosa-100 pt-2">
              <div className="flex justify-between text-tinta/60"><span>Productos</span><span>{pesos(p.subtotal)}</span></div>
              {p.domicilio_valor ? <div className="flex justify-between text-tinta/60"><span>Domicilio</span><span>{pesos(p.domicilio_valor)}</span></div> : null}
              {p.descuento ? <div className="flex justify-between text-tinta/60"><span>Descuento</span><span>−{pesos(p.descuento)}</span></div> : null}
              {p.recargo ? <div className="flex justify-between text-tinta/60"><span>Recargo</span><span>{pesos(p.recargo)}</span></div> : null}
              <div className="flex justify-between font-extrabold text-base"><span>Total</span><span>{pesos(p.total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-tinta/60">Pagado</span><span className="text-green-700 font-semibold">{pesos(p.pagado)}</span></div>
              {pendiente > 0 ? <div className="flex justify-between text-sm"><span className="text-tinta/60">Pendiente</span><span className="text-red-600 font-semibold">{pesos(pendiente)}</span></div> : null}
            </div>
          </Bloque>

          {/* Entrega */}
          <Bloque titulo={p.tipo_entrega === 'recoge' ? 'Recoge en tienda' : 'Entrega'} icono={<MapPin className="size-4" />}>
            <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {p.ocasion === 'funebre' ? (<>
                <Dato k="Fallecido" v={p.fallecido} /><Dato k="Funeraria / sala" v={[p.funeraria, p.sala && `sala ${p.sala}`].filter(Boolean).join(' · ')} />
              </>) : (<>
                <Dato k="Recibe" v={p.recibe_nombre} />
                <Dato k="Tel. recibe" v={p.recibe_telefono ? <a className="text-rosa-600" href={`tel:${p.recibe_telefono}`}>{telefonoBonito(p.recibe_telefono)}</a> : null} />
              </>)}
              {p.tipo_entrega === 'domicilio' ? (<>
                <Dato k="Zona" v={p.zona_nombre} /><Dato k="Dirección" v={p.direccion} />
                <Dato k="Referencia" v={p.punto_referencia} />
              </>) : null}
              <Dato k="Domiciliario" v={p.domiciliario_nombre} />
              <Dato k="Prepara" v={p.preparador_nombre} />
              <Dato k="Tiempos" v={[p.hora_lista && `listo ${p.hora_lista}`, p.hora_salida && `salió ${p.hora_salida}`, p.hora_entregado && `entregado ${p.hora_entregado}`].filter(Boolean).join(' · ')} />
            </dl>
            {p.evidencia_foto ? <a href={`/uploads/${p.evidencia_foto}`} target="_blank" rel="noreferrer" className="block mt-3"><img src={`/uploads/${p.evidencia_foto}`} alt="Evidencia de entrega" className="max-h-56 rounded-xl object-cover" /></a> : null}
          </Bloque>

          {/* Tarjeta */}
          {(p.tarjeta_para || p.tarjeta_mensaje || p.tarjeta_de) ? (
            <Bloque titulo="Tarjeta" icono={<span>💌</span>}>
              <div className="rounded-xl border-2 border-dashed border-rosa-200 bg-rosa-50 p-4 text-sm space-y-1">
                {p.tarjeta_para ? <p><b>Para:</b> {p.tarjeta_para}</p> : null}
                {p.tarjeta_mensaje ? <p className="italic whitespace-pre-wrap">"{p.tarjeta_mensaje}"</p> : null}
                {p.tarjeta_de ? <p className="text-right"><b>De:</b> {p.tarjeta_de}</p> : null}
              </div>
            </Bloque>
          ) : null}

          {/* Pagos */}
          <Bloque titulo="Pagos" icono={<CreditCard className="size-4" />} accion={pendiente > 0 && p.estado !== 'cancelado' ? <button onClick={() => { setPago({ medio: config?.medios_pago[0]?.clave || 'efectivo', monto: String(pendiente), nota: '', comprobante: null }); setModal('pago'); }} className="boton-suave py-1.5 text-xs">+ Pago</button> : null}>
            {p.pagos?.length ? (
              <div className="divide-y divide-rosa-50 text-sm">
                {p.pagos.map((pg) => (
                  <div key={pg.id} className={`py-2 flex items-center gap-3 ${pg.anulado ? 'opacity-40 line-through' : ''}`}>
                    <div className="flex-1"><b>{medioNombre(pg.medio)}</b> · {fechaHora(pg.fecha)}{pg.nota ? ` · ${pg.nota}` : ''}<div className="text-xs text-tinta/50">{pg.registrado_por_nombre}</div></div>
                    {pg.comprobante ? <a href={`/uploads/${pg.comprobante}`} target="_blank" rel="noreferrer" className="text-xs text-rosa-600 font-semibold">comprobante</a> : null}
                    <b>{pesos(pg.monto)}</b>
                    {esAdmin && !pg.anulado ? <button className="text-xs text-red-600 cursor-pointer" onClick={() => confirm('¿Anular este pago?') && accion(() => api.anularPago(p.id, pg.id), 'Pago anulado')}>anular</button> : null}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-tinta/50">Sin pagos registrados. Recuerde: el pedido se prepara con el pago completo.</p>}
          </Bloque>
        </div>

        <div className="space-y-4">
          {/* Cliente */}
          <Bloque titulo="Cliente" icono={<Phone className="size-4" />}>
            <p className="font-semibold">{p.cliente_id ? <Link to={`/clientes/${p.cliente_id}`} className="text-rosa-600">{p.cliente_nombre || 'Sin nombre'}</Link> : (p.cliente_nombre || 'Sin nombre')}</p>
            {p.cliente_telefono ? <p className="text-sm">{telefonoBonito(p.cliente_telefono)}</p> : null}
            <p className="text-xs text-tinta/50 mt-1">Canal: {config?.canales.find((c) => c.clave === p.canal)?.nombre || p.canal} · creado {fechaHora(p.creado_en)}{p.creado_por_nombre ? ` por ${p.creado_por_nombre}` : ''}</p>
            {p.cliente_telefono ? (
              <div className="flex gap-2 mt-3 no-imprimir">
                <a href={enlaceWa(p.cliente_telefono, textoWa)} target="_blank" rel="noreferrer" className="boton-suave flex-1 py-2 text-xs">WhatsApp</a>
                <a href={`tel:${p.cliente_telefono}`} className="boton-secundario flex-1 py-2 text-xs">Llamar</a>
              </div>
            ) : null}
          </Bloque>

          {/* Notas internas */}
          <Bloque titulo="Notas internas">
            <NotasEditor valor={p.notas_internas || ''} guardar={(v) => accion(() => api.notas(p.id, v), 'Nota guardada')} />
          </Bloque>

          {/* Seguimientos */}
          {p.seguimientos?.length ? (
            <Bloque titulo="Mensajes automáticos" icono={<Send className="size-4" />}>
              <div className="space-y-2 text-xs">
                {p.seguimientos.map((s) => (
                  <div key={s.id} className="rounded-lg border border-rosa-100 p-2">
                    <div className="flex justify-between"><b>{SEGUIMIENTO[s.tipo] || s.tipo}</b><span className={s.estado === 'enviado' ? 'text-green-700' : s.estado === 'fallido' ? 'text-red-600' : s.estado === 'cancelado' ? 'text-tinta/40' : 'text-amber-700'}>{s.estado}</span></div>
                    <p className="text-tinta/60 mt-0.5">{s.estado === 'enviado' ? `enviado ${fechaHora(s.enviado_en)}` : `programado ${fechaHora(s.programado_para)}`}{s.error ? ` · ${s.error}` : ''}</p>
                    <p className="mt-1 line-clamp-2 italic">{s.mensaje}</p>
                    <div className="flex gap-2 mt-1 no-imprimir">
                      {s.estado === 'fallido' ? <button className="text-rosa-600 font-semibold cursor-pointer" onClick={() => accion(() => api.reintentarSeguimiento(p.id, s.id), 'Reintentando')}>reintentar</button> : null}
                      {s.estado === 'pendiente' ? <button className="text-red-600 cursor-pointer" onClick={() => accion(() => api.cancelarSeguimiento(p.id, s.id), 'Cancelado')}>no enviar</button> : null}
                    </div>
                  </div>
                ))}
              </div>
            </Bloque>
          ) : null}

          {/* Historial */}
          <Bloque titulo="Historial">
            <ol className="space-y-1.5 text-xs">
              {p.historial?.map((h) => <li key={h.id}><span className="text-tinta/50">{fechaHora(h.ts)}</span> · <b>{h.usuario_nombre || 'sistema'}</b> · {h.detalle || h.accion}</li>)}
            </ol>
          </Bloque>
        </div>
      </div>

      {/* Modales */}
      <Modal abierto={modal === 'pago'} cerrar={() => setModal('')} titulo={`Registrar pago · ${p.codigo}`}>
        <div className="space-y-3">
          <Campo etiqueta="Medio de pago">
            <Selector valor={pago.medio} onChange={(v) => setPago({ ...pago, medio: v })} opciones={(config?.medios_pago || []).map((m) => ({ valor: m.clave, nombre: m.nombre, detalle: m.detalle, icono: <span>{ICONO_MEDIO[m.clave] || '💳'}</span> }))} />
          </Campo>
          <Campo etiqueta="Monto" ayuda={`Pendiente: ${pesos(pendiente)}`}><input className="campo text-lg font-bold" inputMode="numeric" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} /></Campo>
          <div className="flex gap-2">{[pendiente, 50000, 100000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => <button key={v} type="button" className="insignia bg-rosa-100 text-rosa-700 cursor-pointer" onClick={() => setPago({ ...pago, monto: String(v) })}>{pesos(v)}</button>)}</div>
          <Campo etiqueta="Nota (opcional)"><input className="campo" value={pago.nota} onChange={(e) => setPago({ ...pago, nota: e.target.value })} placeholder="Ref. transferencia, quién pagó…" /></Campo>
          <Campo etiqueta="Comprobante (captura)"><input className="campo" type="file" accept="image/*,application/pdf" onChange={(e) => setPago({ ...pago, comprobante: e.target.files?.[0] || null })} /></Campo>
          <button disabled={ocupado || !Number(pago.monto)} onClick={() => accion(() => api.registrarPago(p.id, { medio: pago.medio, monto: Number(pago.monto), nota: pago.nota, comprobante: pago.comprobante }), 'Pago registrado')} className="boton-primario w-full py-3">Guardar pago</button>
        </div>
      </Modal>

      <Modal abierto={modal === 'evidencia'} cerrar={() => setModal('')} titulo="Entrega con foto">
        <div className="space-y-3">
          <p className="text-sm text-tinta/70">Tome la foto del arreglo entregado (o del lugar). Queda como evidencia y el pedido pasa a <b>Entregado</b>.</p>
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fotoRef.current?.click()} className="boton-secundario w-full py-6 border-dashed"><Camera className="size-5" /> {foto ? foto.name : 'Tomar o elegir foto'}</button>
          {foto ? <img src={URL.createObjectURL(foto)} alt="" className="max-h-64 rounded-xl mx-auto" /> : null}
          <button disabled={ocupado || !foto} onClick={() => accion(() => api.evidencia(p.id, foto!, p.estado !== 'entregado'), 'Entrega registrada')} className="boton-primario w-full py-3">{p.estado === 'entregado' ? 'Guardar foto' : 'Marcar entregado con esta foto'}</button>
          {p.estado !== 'entregado' ? <button disabled={ocupado} onClick={() => accion(() => api.cambiarEstado(p.id, 'entregado'), 'Pedido entregado')} className="boton-fantasma w-full text-xs">Marcar entregado sin foto</button> : null}
        </div>
      </Modal>

      <Modal abierto={modal === 'asignar'} cerrar={() => setModal('')} titulo="Asignar y programar">
        <AsignarForm p={p} domiciliarios={domiciliarios} preparadores={preparadores} franjas={config?.franjas || []} guardar={(d) => accion(() => api.asignar(p.id, d), 'Asignación guardada')} ocupado={ocupado} />
      </Modal>

      <Modal abierto={modal === 'cancelar'} cerrar={() => setModal('')} titulo={`Cancelar ${p.codigo}`}>
        <div className="space-y-3">
          <Campo etiqueta="Motivo"><input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Cliente desistió, no pagó, duplicado…" autoFocus /></Campo>
          <button disabled={ocupado} onClick={() => accion(() => api.cambiarEstado(p.id, 'cancelado', motivo), 'Pedido cancelado')} className="boton-peligro w-full py-3">Confirmar cancelación</button>
        </div>
      </Modal>

      <Modal abierto={modal === 'mensaje'} cerrar={() => setModal('')} titulo="Mensaje al cliente por WhatsApp">
        <div className="space-y-3">
          <p className="text-xs text-tinta/60">Sale desde el número de la floristería ({config?.negocio.telefono}). Si prefiere escribirlo usted, use el botón WhatsApp del cliente.</p>
          <div className="flex flex-wrap gap-1.5">
            {[['Salió', `Su pedido ${p.codigo} ya salió a ruta 🛵 El domiciliario llama cuando esté cerca.`], ['Listo para recoger', `Su pedido ${p.codigo} está listo para recoger en nuestro punto 🌸 ${config?.negocio.direccion}`], ['Falta pago', `Hola, para preparar su pedido ${p.codigo} nos falta el pago de ${pesos(pendiente)}. Recuerde que necesitamos el pago mínimo 3 horas antes 🙏`]].map(([t, m]) => (
              <button key={t} type="button" className="insignia bg-rosa-100 text-rosa-700 cursor-pointer" onClick={() => setMensaje(m)}>{t}</button>
            ))}
          </div>
          <textarea className="campo" rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          <button disabled={ocupado || !mensaje.trim() || !p.cliente_telefono} onClick={() => accion(() => api.mensajeManual({ pedido_id: p.id, mensaje }), 'Mensaje enviado')} className="boton-primario w-full py-3"><Send className="size-4" /> Enviar</button>
        </div>
      </Modal>
    </div>
  );
}

function Bloque({ titulo, icono, accion, children }: { titulo: string; icono?: React.ReactNode; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="tarjeta p-4">
      <div className="flex items-center justify-between mb-2"><h2 className="font-bold text-sm flex items-center gap-2 text-tinta/80">{icono}{titulo}</h2>{accion}</div>
      {children}
    </section>
  );
}
function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  if (!v) return null;
  return <div><dt className="text-[11px] uppercase tracking-wide text-tinta/50 font-semibold">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
function NotasEditor({ valor, guardar }: { valor: string; guardar: (v: string) => void }) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <div className="space-y-2">
      <textarea className="campo text-sm" rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Solo lo ve el equipo" />
      {v !== valor ? <button onClick={() => guardar(v)} className="boton-suave w-full py-1.5 text-xs">Guardar nota</button> : null}
    </div>
  );
}
function AsignarForm({ p, domiciliarios, preparadores, franjas, guardar, ocupado }: { p: Pedido; domiciliarios: Domiciliario[]; preparadores: { id: number; nombre: string }[]; franjas: { clave: string; nombre: string; desde: string; hasta: string }[]; guardar: (d: { preparador_id: number | null; domiciliario_id: number | null; hora_entrega: string; franja: string }) => void; ocupado: boolean }) {
  const [d, setD] = useState({ preparador_id: p.preparador_id, domiciliario_id: p.domiciliario_id, hora_entrega: p.hora_entrega || '', franja: p.franja || '' });
  return (
    <div className="space-y-3">
      <Campo etiqueta="Quién lo prepara"><select className="campo" value={d.preparador_id ?? ''} onChange={(e) => setD({ ...d, preparador_id: e.target.value ? Number(e.target.value) : null })}><option value="">Nadie aún</option>{preparadores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></Campo>
      {p.tipo_entrega === 'domicilio' ? <Campo etiqueta="Domiciliario"><select className="campo" value={d.domiciliario_id ?? ''} onChange={(e) => setD({ ...d, domiciliario_id: e.target.value ? Number(e.target.value) : null })}><option value="">Sin asignar</option>{domiciliarios.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></Campo> : null}
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Franja"><select className="campo" value={d.franja} onChange={(e) => setD({ ...d, franja: e.target.value })}><option value="">Sin franja</option>{franjas.map((f) => <option key={f.clave} value={f.clave}>{f.nombre} {f.desde}–{f.hasta}</option>)}</select></Campo>
        <Campo etiqueta="Hora puntual"><input className="campo" type="time" value={d.hora_entrega} onChange={(e) => setD({ ...d, hora_entrega: e.target.value })} /></Campo>
      </div>
      <button disabled={ocupado} onClick={() => guardar(d)} className="boton-primario w-full py-3">Guardar</button>
      {p.fecha_entrega < hoy() ? <p className="text-xs text-amber-700">Este pedido tiene fecha pasada. Para moverlo de día use Editar.</p> : null}
    </div>
  );
}
