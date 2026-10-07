import { useEffect, useMemo, useState } from 'react';
import { api, pesos, num, duracion, minutosEntre, hoyISO, fechaLarga } from '../api.js';
import Buscador from '../components/Buscador.jsx';

const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '4', '6', '8', '10', '12', '14', '16', '28', '30', '32', '34', '36', '38', '40', '42', '44'];

const inicial = () => ({
  trabajador_id: null,
  fecha: hoyISO(),
  hora_inicio: '',
  hora_fin: '',
  tipo_doc: 'OC',
  num_orden: '',
  orden_compra: '',
  cliente: '',
  talla: '',
  prenda_id: null,
  cantidad: '',
  observaciones: '',
});

let llave = 0;
const nuevoAdicional = () => ({ key: ++llave, adicional_id: null, cantidad_por_prenda: 1, prendas: '' });

export default function Registro({ catalogos, irA }) {
  const { trabajadores, prendas, adicionales } = catalogos;
  const [f, setF] = useState(inicial);
  const [adics, setAdics] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [delDia, setDelDia] = useState([]);

  const set = (campo) => (e) => setF((v) => ({ ...v, [campo]: e?.target ? e.target.value : e }));

  useEffect(() => { api.get('/clientes').then(setClientes).catch(() => {}); }, []);

  const trabajador = trabajadores.find((t) => t.id === f.trabajador_id);
  const prenda = prendas.find((p) => p.id === f.prenda_id);
  const externo = trabajador?.tipo === 'EXTERNO';

  // Operaciones ya registradas ese día para ese trabajador
  useEffect(() => {
    if (!f.trabajador_id || !f.fecha) return setDelDia([]);
    api.get(`/operaciones?trabajador_id=${f.trabajador_id}&desde=${f.fecha}&hasta=${f.fecha}`).then(setDelDia).catch(() => {});
  }, [f.trabajador_id, f.fecha]);

  const opcionesTrab = useMemo(
    () => trabajadores
      .filter((t) => t.activo && t.livianas)
      .map((t) => ({ id: t.id, etiqueta: t.nombre, detalle: `${t.codigo} · ${t.especialidad || ''}`, grupo: t.tipo === 'INTERNO' ? 'Operarios internos' : 'Talleres externos', busqueda: `${t.nombre} ${t.codigo}` })),
    [trabajadores],
  );
  const opcionesPrenda = useMemo(
    () => prendas.filter((p) => p.activo).map((p) => ({ id: p.id, etiqueta: `${p.codigo} · ${p.nombre}`, detalle: `Interno ${pesos(p.tarifa_interna)} / Externo ${pesos(p.tarifa_externa)}` })),
    [prendas],
  );
  const opcionesAdic = useMemo(
    () => adicionales.filter((a) => a.activo).map((a) => ({ id: a.id, etiqueta: `${a.codigo} · ${a.nombre}`, detalle: pesos(externo ? a.tarifa_externa : a.tarifa_interna), grupo: a.categoria })),
    [adicionales, externo],
  );

  const cantidad = Number(f.cantidad) || 0;
  const minutos = minutosEntre(f.hora_inicio, f.hora_fin);
  const tarifa = prenda ? (externo ? prenda.tarifa_externa : prenda.tarifa_interna) : 0;
  const valorPrendas = Math.round(tarifa * cantidad);

  const lineasAdic = adics.map((a) => {
    const ad = adicionales.find((x) => x.id === a.adicional_id);
    const t = ad ? (externo ? ad.tarifa_externa : ad.tarifa_interna) : 0;
    const p = Number(a.prendas) || cantidad;
    const cpp = Number(a.cantidad_por_prenda) || 0;
    return { ...a, ad, tarifa: t, prendasEf: p, valor: Math.round(t * cpp * p) };
  });
  const valorAdic = lineasAdic.reduce((s, a) => s + a.valor, 0);
  const total = valorPrendas + valorAdic;

  const cambiarAdic = (key, campo, valor) => setAdics((l) => l.map((a) => (a.key === key ? { ...a, [campo]: valor } : a)));

  const guardar = async (e) => {
    e.preventDefault();
    setMensaje(null);
    if (!f.trabajador_id) return setMensaje({ tipo: 'error', texto: 'Elige el trabajador.' });
    if (!f.prenda_id) return setMensaje({ tipo: 'error', texto: 'Elige la prenda o referencia.' });
    if (minutos <= 0) return setMensaje({ tipo: 'error', texto: 'La hora de fin debe ser posterior a la hora de inicio.' });
    if (adics.some((a) => !a.adicional_id)) return setMensaje({ tipo: 'error', texto: 'Hay un adicional sin elegir. Elígelo o quítalo.' });

    setGuardando(true);
    try {
      const op = await api.post('/operaciones', {
        ...f,
        adicionales: adics.map(({ adicional_id, cantidad_por_prenda, prendas: p }) => ({ adicional_id, cantidad_por_prenda, prendas: p || cantidad })),
      });
      setMensaje({ tipo: 'ok', texto: `Operación guardada: ${op.cantidad} × ${op.prenda} para ${op.trabajador} — ${pesos(op.total)}.` });
      setDelDia((d) => [op, ...d]);
      if (f.cliente && !clientes.includes(f.cliente.toUpperCase())) setClientes((c) => [...c, f.cliente.toUpperCase()].sort());
      // Se conserva trabajador, fecha, orden y prenda para registrar rápido la siguiente talla o tramo
      setF((v) => ({ ...v, hora_inicio: v.hora_fin, hora_fin: '', talla: '', cantidad: '', observaciones: '' }));
      setAdics((l) => l.map((a) => ({ ...a, prendas: '' })));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const limpiar = () => { setF(inicial()); setAdics([]); setMensaje(null); };

  return (
    <form className="registro" onSubmit={guardar}>
      <div className="registro-campos">
        <section className="bloque">
          <h2>Trabajador y jornada</h2>
          <div className="rejilla">
            <label className="campo ancho-2">
              <span>Trabajador</span>
              <Buscador id="trab" autoFocus opciones={opcionesTrab} valor={f.trabajador_id} onChange={set('trabajador_id')} placeholder="Busca por nombre o código" />
              {trabajador && (
                <span className={`etiqueta-tipo ${externo ? 'externo' : 'interno'}`}>
                  {externo ? 'Taller externo' : 'Operario interno'} · se paga con tarifa {externo ? 'externa' : 'interna'}
                </span>
              )}
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
              <input value={f.cliente} onChange={set('cliente')} list="lista-clientes" placeholder="Ej. HELADERIA AMERICANA" />
              <datalist id="lista-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
          </div>
        </section>

        <section className="bloque">
          <h2>Producción</h2>
          <div className="rejilla">
            <label className="campo ancho-2">
              <span>Prenda o referencia</span>
              <Buscador id="prenda" opciones={opcionesPrenda} valor={f.prenda_id} onChange={set('prenda_id')} placeholder="Busca por nombre o código (P001…)" />
            </label>
            <label className="campo">
              <span>Talla</span>
              <input value={f.talla} onChange={set('talla')} list="lista-tallas" placeholder="Ej. M, 32" />
              <datalist id="lista-tallas">{TALLAS.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="campo">
              <span>Cantidad de prendas</span>
              <input type="number" min="1" step="1" inputMode="numeric" value={f.cantidad} onChange={set('cantidad')} required />
            </label>
          </div>

          <div className="adicionales">
            <div className="adicionales-cabecera">
              <h3>Adicionales de la prenda</h3>
              <p>Cinta reflectiva, bolsillos, marquilla, charreteras, ojal, botón… Se calcula tarifa × cantidad por prenda × prendas.</p>
            </div>
            {lineasAdic.map((a) => (
              <div className="adicional-fila" key={a.key}>
                <label className="campo">
                  <span>Adicional</span>
                  <Buscador opciones={opcionesAdic} valor={a.adicional_id} onChange={(v) => cambiarAdic(a.key, 'adicional_id', v)} placeholder="Busca: cinta, bolsillo, marquilla…" />
                </label>
                <label className="campo corto">
                  <span>Cant. por prenda</span>
                  <input type="number" min="0" step="0.01" value={a.cantidad_por_prenda} onChange={(e) => cambiarAdic(a.key, 'cantidad_por_prenda', e.target.value)} title="Ej. metros de cinta por prenda, número de bolsillos, pares" />
                </label>
                <label className="campo corto">
                  <span>Prendas que lo llevan</span>
                  <input type="number" min="1" step="1" value={a.prendas} placeholder={cantidad || 'Todas'} onChange={(e) => cambiarAdic(a.key, 'prendas', e.target.value)} />
                </label>
                <div className="campo dato-calculado corto">
                  <span>{a.ad ? `${pesos(a.tarifa)} c/u` : 'Valor'}</span>
                  <strong>{pesos(a.valor)}</strong>
                </div>
                <button type="button" className="boton-quitar" onClick={() => setAdics((l) => l.filter((x) => x.key !== a.key))} aria-label="Quitar adicional">Quitar</button>
              </div>
            ))}
            <button type="button" className="boton-secundario" onClick={() => setAdics((l) => [...l, nuevoAdicional()])}>Agregar adicional</button>
          </div>

          <label className="campo">
            <span>Observaciones</span>
            <input value={f.observaciones} onChange={set('observaciones')} placeholder="Opcional" />
          </label>
        </section>
      </div>

      <aside className="resumen-registro">
        <div className="pespunte">
          <h2>Liquidación de esta operación</h2>
          <dl className="calculo">
            <div><dt>Horario</dt><dd>{f.hora_inicio && f.hora_fin && minutos > 0 ? `${f.hora_inicio} a ${f.hora_fin} (${duracion(minutos)})` : '—'}</dd></div>
            <div><dt>Prenda</dt><dd>{prenda ? prenda.nombre : '—'}</dd></div>
            <div><dt>Tarifa {trabajador ? (externo ? 'externa' : 'interna') : ''}</dt><dd>{prenda && trabajador ? pesos(tarifa) : '—'}</dd></div>
            <div><dt>{cantidad || 0} prendas × tarifa</dt><dd>{pesos(valorPrendas)}</dd></div>
            {lineasAdic.filter((a) => a.ad).map((a) => (
              <div key={a.key} className="calculo-adic">
                <dt>{a.ad.nombre}<small>{num(a.cantidad_por_prenda)} × {a.prendasEf} prendas × {pesos(a.tarifa)}</small></dt>
                <dd>{pesos(a.valor)}</dd>
              </div>
            ))}
            {minutos > 0 && cantidad > 0 && (
              <div className="calculo-ritmo"><dt>Ritmo</dt><dd>{num(cantidad / (minutos / 60))} prendas/hora</dd></div>
            )}
          </dl>
          <div className="total-operacion">
            <span>A pagar</span>
            <strong>{pesos(total)}</strong>
          </div>
          <button type="submit" className="boton-principal" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar operación'}</button>
          <button type="button" className="boton-texto" onClick={limpiar}>Empezar de cero</button>
        </div>

        {mensaje && <div className={`aviso ${mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}`} role="status">{mensaje.texto}</div>}

        {trabajador && delDia.length > 0 && (
          <div className="del-dia">
            <h3>{trabajador.nombre} · {fechaLarga(f.fecha)}</h3>
            <ul>
              {delDia.map((o) => (
                <li key={o.id}>
                  <span>{o.hora_inicio}–{o.hora_fin} · {o.cantidad} {o.prenda.toLowerCase()}{o.talla ? ` (${o.talla})` : ''}</span>
                  <strong>{pesos(o.total)}</strong>
                </li>
              ))}
            </ul>
            <p className="del-dia-total">Total del día <strong>{pesos(delDia.reduce((s, o) => s + o.total, 0))}</strong></p>
            <button type="button" className="boton-texto" onClick={() => irA('liquidacion')}>Ver liquidación completa</button>
          </div>
        )}
      </aside>
    </form>
  );
}
