import { useEffect, useMemo, useState } from 'react';
import { api, pesos, num, duracion, minutosEntre, hoyISO, fechaLarga } from '../../api.js';
import Buscador from '../../components/Buscador.jsx';
import { Etiqueta, minutosTexto } from './eficiencia.jsx';

const TALLAS = ['6', '8', '10', '12', '14', '16', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const PRENDAS_BASE = ['PANTALON JEAN CABALLERO', 'PANTALON JEAN DAMA', 'PANTALON JEAN TIPO CARGO', 'CAMISA JEAN', 'CHAQUETA JEAN', 'CHAQUETA SOLDADOR'];
export const PROCESOS = { JEAN: 'Jean', CHAQUETA: 'Chaqueta' };

const inicial = () => ({
  trabajador_id: null,
  proceso: 'JEAN',
  fecha: hoyISO(),
  hora_inicio: '',
  hora_fin: '',
  tipo_doc: 'OC',
  num_orden: '',
  orden_compra: '',
  cliente: '',
  prenda: '',
  talla: '',
  cantidad: '',
  observaciones: '',
});

let llave = 0;
const nuevaLinea = () => ({ key: ++llave, operacion_id: null, cantidad: '' });

export default function RegistroJC({ catalogos, irA }) {
  const { trabajadores, jcOperaciones } = catalogos;
  const [f, setF] = useState(inicial);
  const [lineas, setLineas] = useState(() => [nuevaLinea()]);
  const [clientes, setClientes] = useState([]);
  const [prendasUsadas, setPrendasUsadas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [delDia, setDelDia] = useState([]);

  const set = (campo) => (e) => setF((v) => ({ ...v, [campo]: e?.target ? e.target.value : e }));

  useEffect(() => {
    api.get('/clientes').then(setClientes).catch(() => {});
    api.get('/jc/prendas').then(setPrendasUsadas).catch(() => {});
  }, []);

  const trabajador = trabajadores.find((t) => t.id === f.trabajador_id);
  const externo = trabajador?.tipo === 'EXTERNO';

  useEffect(() => {
    if (!f.trabajador_id || !f.fecha) return setDelDia([]);
    api.get(`/jc/registros?trabajador_id=${f.trabajador_id}&desde=${f.fecha}&hasta=${f.fecha}`).then(setDelDia).catch(() => {});
  }, [f.trabajador_id, f.fecha]);

  const opcionesTrab = useMemo(
    () => trabajadores
      .filter((t) => t.activo && t.jean)
      .map((t) => ({ id: t.id, etiqueta: t.nombre, detalle: `${t.codigo} · ${t.especialidad || ''}`, grupo: t.tipo === 'INTERNO' ? 'Operarios internos' : 'Talleres externos', busqueda: `${t.nombre} ${t.codigo}` })),
    [trabajadores],
  );

  // Primero las operaciones del proceso elegido; las del otro proceso quedan disponibles debajo
  const opcionesOp = useMemo(() => {
    const activas = jcOperaciones.filter((o) => o.activo);
    const orden = [f.proceso, ...Object.keys(PROCESOS).filter((p) => p !== f.proceso)];
    return orden.flatMap((p) => activas.filter((o) => o.proceso === p).map((o) => ({
      id: o.id,
      etiqueta: `${o.codigo} · ${o.nombre}`,
      detalle: `${o.maquina || 'Sin máquina'} · ${pesos(o.valor)}${o.tiempo_estandar != null ? ` · ${num(o.tiempo_estandar)} s` : ''}`,
      grupo: `Operaciones de ${PROCESOS[p].toLowerCase()}`,
    })));
  }, [jcOperaciones, f.proceso]);

  const prendasSugeridas = [...new Set([...prendasUsadas, ...PRENDAS_BASE])];

  const cantidad = Number(f.cantidad) || 0;
  const minutos = minutosEntre(f.hora_inicio, f.hora_fin);

  const calculadas = lineas.map((l) => {
    const op = jcOperaciones.find((o) => o.id === l.operacion_id);
    const cant = l.cantidad === '' ? cantidad : Number(l.cantidad) || 0;
    return { ...l, op, cant, valor: op ? Math.round(op.valor * cant) : 0 };
  });
  const total = calculadas.reduce((s, l) => s + l.valor, 0);
  const valorPorPrenda = cantidad ? total / cantidad : 0;
  // Estudio de tiempos: lo que debería tardar según el tiempo estándar, frente a lo que tardó
  const conOp = calculadas.filter((l) => l.op);
  const sinTiempo = conOp.filter((l) => l.op.tiempo_estandar == null).length;
  const minEstimados = conOp.reduce((s, l) => s + (l.op.tiempo_estandar || 0) * l.cant, 0) / 60;
  const costoMinuto = catalogos.parametros?.costo_minuto || 0;

  const cambiarLinea = (key, campo, valor) => setLineas((l) => l.map((x) => (x.key === key ? { ...x, [campo]: valor } : x)));

  const guardar = async (e) => {
    e.preventDefault();
    setMensaje(null);
    if (!f.trabajador_id) return setMensaje({ tipo: 'error', texto: 'Elige el trabajador.' });
    if (!f.prenda.trim()) return setMensaje({ tipo: 'error', texto: 'Escribe la prenda o referencia.' });
    if (minutos <= 0) return setMensaje({ tipo: 'error', texto: 'La hora de fin debe ser posterior a la hora de inicio.' });
    const elegidas = lineas.filter((l) => l.operacion_id);
    if (!elegidas.length) return setMensaje({ tipo: 'error', texto: 'Agrega al menos una operación.' });

    setGuardando(true);
    try {
      const r = await api.post('/jc/registros', { ...f, operaciones: elegidas.map(({ operacion_id, cantidad: c }) => ({ operacion_id, cantidad: c })) });
      setMensaje({ tipo: 'ok', texto: `Guardado: ${r.cantidad} × ${r.prenda.toLowerCase()} (${r.operaciones.length} operaciones) para ${r.trabajador} — ${pesos(r.total)}.` });
      setDelDia((d) => [r, ...d]);
      if (f.cliente && !clientes.includes(f.cliente.toUpperCase())) setClientes((c) => [...c, f.cliente.toUpperCase()].sort());
      if (!prendasUsadas.includes(r.prenda)) setPrendasUsadas((p) => [...p, r.prenda].sort());
      // Se conservan trabajador, orden, prenda y operaciones para registrar rápido la siguiente talla
      setF((v) => ({ ...v, hora_inicio: v.hora_fin, hora_fin: '', talla: '', cantidad: '', observaciones: '' }));
      setLineas((l) => l.filter((x) => x.operacion_id).map((x) => ({ ...x, cantidad: '' })));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const limpiar = () => { setF(inicial()); setLineas([nuevaLinea()]); setMensaje(null); };

  return (
    <form className="registro" onSubmit={guardar}>
      <div className="registro-campos">
        <section className="bloque">
          <h2>Trabajador y jornada</h2>
          <div className="rejilla">
            <label className="campo ancho-2">
              <span>Trabajador</span>
              <Buscador id="trab-jc" autoFocus opciones={opcionesTrab} valor={f.trabajador_id} onChange={set('trabajador_id')} placeholder="Busca por nombre o código" />
              {trabajador && <span className={`etiqueta-tipo ${externo ? 'externo' : 'interno'}`}>{externo ? 'Taller externo' : 'Operario interno'}</span>}
            </label>
            <label className="campo">
              <span>Fecha del trabajo</span>
              <input type="date" value={f.fecha} onChange={set('fecha')} required />
            </label>
            <label className="campo">
              <span>Hora de inicio</span>
              <input type="time" value={f.hora_inicio} onChange={set('hora_inicio')} required />
            </label>
            <label className="campo">
              <span>Hora de fin</span>
              <input type="time" value={f.hora_fin} onChange={set('hora_fin')} required />
            </label>
            <div className="campo dato-calculado">
              <span>Duración</span>
              <strong className={minutos < 0 ? 'texto-error' : ''}>{minutos < 0 ? 'Revisa las horas' : duracion(minutos)}</strong>
            </div>
          </div>
          {opcionesTrab.length === 0 && <p className="nota">No hay trabajadores marcados en jeans y chaquetas. Márcalos en la pestaña Trabajadores.</p>}
        </section>

        <section className="bloque">
          <h2>Orden y cliente</h2>
          <div className="rejilla">
            <div className="campo">
              <span>Tipo de documento</span>
              <div className="segmentado" role="radiogroup" aria-label="Tipo de documento">
                {['OC', 'ORC'].map((t) => (
                  <button type="button" key={t} role="radio" aria-checked={f.tipo_doc === t} className={f.tipo_doc === t ? 'activo' : ''} onClick={() => set('tipo_doc')(t)}>{t}</button>
                ))}
              </div>
            </div>
            <label className="campo">
              <span>N.º orden de corte</span>
              <input value={f.num_orden} onChange={set('num_orden')} placeholder="Ej. 1010326" required />
            </label>
            <label className="campo">
              <span>Orden de compra del cliente</span>
              <input value={f.orden_compra} onChange={set('orden_compra')} placeholder="Opcional" />
            </label>
            <label className="campo">
              <span>Cliente</span>
              <input value={f.cliente} onChange={set('cliente')} list="lista-clientes-jc" placeholder="Ej. STEELWORK" />
              <datalist id="lista-clientes-jc">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
          </div>
        </section>

        <section className="bloque">
          <h2>Prenda y operaciones</h2>
          <div className="rejilla">
            <div className="campo">
              <span>Proceso</span>
              <div className="segmentado" role="radiogroup" aria-label="Proceso">
                {Object.entries(PROCESOS).map(([k, n]) => (
                  <button type="button" key={k} role="radio" aria-checked={f.proceso === k} className={f.proceso === k ? 'activo' : ''} onClick={() => set('proceso')(k)}>{n}</button>
                ))}
              </div>
            </div>
            <label className="campo ancho-2">
              <span>Prenda o referencia</span>
              <input value={f.prenda} onChange={set('prenda')} list="lista-prendas-jc" placeholder="Ej. PANTALON JEAN CABALLERO" required />
              <datalist id="lista-prendas-jc">{prendasSugeridas.map((p) => <option key={p} value={p} />)}</datalist>
            </label>
            <label className="campo">
              <span>Talla</span>
              <input value={f.talla} onChange={set('talla')} list="lista-tallas-jc" placeholder="Ej. 32, M" />
              <datalist id="lista-tallas-jc">{TALLAS.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="campo">
              <span>Cantidad de prendas</span>
              <input type="number" min="1" step="1" inputMode="numeric" value={f.cantidad} onChange={set('cantidad')} required />
            </label>
          </div>

          <div className="adicionales">
            <div className="adicionales-cabecera">
              <h3>Operaciones que hizo</h3>
              <p>Se paga valor de la operación × cantidad. Si deja la cantidad vacía, se toman todas las prendas.</p>
            </div>
            {calculadas.map((l) => (
              <div className="adicional-fila operacion-fila" key={l.key}>
                <label className="campo">
                  <span>Operación</span>
                  <Buscador opciones={opcionesOp} valor={l.operacion_id} onChange={(v) => cambiarLinea(l.key, 'operacion_id', v)} placeholder="Busca: dobladillo, pretina, OPR024…" />
                </label>
                <div className="campo dato-calculado corto">
                  <span>Máquina</span>
                  <strong className="maquina">{l.op ? l.op.maquina || '—' : '—'}</strong>
                </div>
                <label className="campo corto">
                  <span>Cantidad</span>
                  <input type="number" min="0" step="any" value={l.cantidad} placeholder={cantidad || 'Todas'} onChange={(e) => cambiarLinea(l.key, 'cantidad', e.target.value)} />
                </label>
                <div className="campo dato-calculado corto">
                  <span>{l.op ? `${pesos(l.op.valor)} c/u` : 'Valor'}</span>
                  <strong>{pesos(l.valor)}</strong>
                </div>
                <button type="button" className="boton-quitar" onClick={() => setLineas((x) => x.filter((y) => y.key !== l.key))} aria-label="Quitar operación">Quitar</button>
              </div>
            ))}
            <button type="button" className="boton-secundario" onClick={() => setLineas((l) => [...l, nuevaLinea()])}>Agregar operación</button>
          </div>

          <label className="campo">
            <span>Observaciones</span>
            <input value={f.observaciones} onChange={set('observaciones')} placeholder="Opcional" />
          </label>
        </section>
      </div>

      <aside className="resumen-registro">
        <div className="pespunte">
          <h2>Liquidación de este trabajo</h2>
          <dl className="calculo">
            <div><dt>Horario</dt><dd>{f.hora_inicio && f.hora_fin && minutos > 0 ? `${f.hora_inicio} a ${f.hora_fin} (${duracion(minutos)})` : '—'}</dd></div>
            <div><dt>Prenda</dt><dd>{f.prenda ? `${f.prenda.toUpperCase()} · ${PROCESOS[f.proceso]}` : '—'}</dd></div>
            <div><dt>Prendas</dt><dd>{cantidad || '—'}</dd></div>
            {calculadas.filter((l) => l.op).map((l) => (
              <div key={l.key} className="calculo-adic">
                <dt>{l.op.nombre}<small>{num(l.cant)} × {pesos(l.op.valor)}</small></dt>
                <dd>{pesos(l.valor)}</dd>
              </div>
            ))}
            {cantidad > 0 && total > 0 && <div className="calculo-ritmo"><dt>Valor por prenda</dt><dd>{pesos(valorPorPrenda)}</dd></div>}
            {conOp.length > 0 && cantidad > 0 && (
              <div className="calculo-tiempo">
                <dt>Tiempo estimado<small>{sinTiempo ? `${sinTiempo} operación(es) sin tiempo estándar` : `Costo estimado ${pesos(minEstimados * costoMinuto)}`}</small></dt>
                <dd>{sinTiempo ? '—' : minutosTexto(minEstimados)}</dd>
              </div>
            )}
            {conOp.length > 0 && cantidad > 0 && minutos > 0 && (
              <div className="calculo-tiempo">
                <dt>Resultado<small>Real {duracion(minutos)} · costo real {pesos(minutos * costoMinuto)}</small></dt>
                <dd><Etiqueta diferencia={minutos - minEstimados} comparable={!sinTiempo} /></dd>
              </div>
            )}
            {minutos > 0 && cantidad > 0 && <div className="calculo-ritmo"><dt>Ritmo</dt><dd>{num(cantidad / (minutos / 60))} prendas/hora</dd></div>}
          </dl>
          <div className="total-operacion">
            <span>A pagar</span>
            <strong>{pesos(total)}</strong>
          </div>
          <button type="submit" className="boton-principal" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar trabajo'}</button>
          <button type="button" className="boton-texto" onClick={limpiar}>Empezar de cero</button>
        </div>

        {mensaje && <div className={`aviso ${mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}`} role="status">{mensaje.texto}</div>}

        {trabajador && delDia.length > 0 && (
          <div className="del-dia">
            <h3>{trabajador.nombre} · {fechaLarga(f.fecha)}</h3>
            <ul>
              {delDia.map((r) => (
                <li key={r.id}>
                  <span>{r.hora_inicio}–{r.hora_fin} · {r.cantidad} {r.prenda.toLowerCase()}{r.talla ? ` (${r.talla})` : ''} · {r.operaciones.length} op.</span>
                  <strong>{pesos(r.total)}</strong>
                </li>
              ))}
            </ul>
            <p className="del-dia-total">Total del día <strong>{pesos(delDia.reduce((s, r) => s + r.total, 0))}</strong></p>
            <button type="button" className="boton-texto" onClick={() => irA('liquidacion')}>Ver liquidación completa</button>
          </div>
        )}
      </aside>
    </form>
  );
}
