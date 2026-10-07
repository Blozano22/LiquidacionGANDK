import { useEffect, useMemo, useState } from 'react';
import { api, pesos, num, fechaLarga } from '../../api.js';
import FiltrosJC, { useFiltrosJC } from '../../components/FiltrosJC.jsx';
import { resumir, agruparPor, minutosTexto, Etiqueta } from './eficiencia.jsx';

const pct = (n) => (n == null ? '—' : `${num(Math.round(n))} %`);
const signo = (n, fmt) => (Math.abs(n) < 0.5 ? fmt(0) : `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}`);

function TablaComparativa({ titulo, filas, primeraColumna, enlace }) {
  return (
    <section className="bloque">
      <h2>{titulo}</h2>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>{primeraColumna}</th><th className="num">Registros</th><th className="num">Prendas</th>
              <th className="num">Tiempo estimado</th><th className="num">Tiempo real</th><th className="num">Eficiencia</th>
              <th className="num">Costo estimado</th><th className="num">Costo real</th><th className="num">Diferencia</th><th>Resultado</th>
              <th className="num">Pagado (mano de obra)</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((g) => (
              <tr key={g.clave}>
                <td>{enlace ? <a href={enlace(g)}>{g.etiqueta}</a> : g.etiqueta}{g.sinTiempo > 0 && <small className="sub alerta">{g.sinTiempo} sin tiempo estándar</small>}</td>
                <td className="num">{g.registros}</td>
                <td className="num">{num(g.prendas)}</td>
                <td className="num">{g.comparables ? minutosTexto(g.minEstimados) : '—'}</td>
                <td className="num">{g.comparables ? minutosTexto(g.minReales) : '—'}</td>
                <td className="num">{pct(g.eficiencia)}</td>
                <td className="num">{g.comparables ? pesos(g.costoEstimado) : '—'}</td>
                <td className="num">{g.comparables ? pesos(g.costoReal) : '—'}</td>
                <td className={`num ${g.difCosto > 0 ? 'texto-error' : 'texto-ok'}`}>{g.comparables ? signo(g.difCosto, pesos) : '—'}</td>
                <td><Etiqueta diferencia={g.difCosto} comparable={g.comparables > 0} /></td>
                <td className="num fuerte">{pesos(g.pagado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CostoMinuto({ valor, recargar }) {
  const [v, setV] = useState(valor ?? '');
  const [mensaje, setMensaje] = useState(null);
  useEffect(() => setV(valor ?? ''), [valor]);

  const guardar = async (e) => {
    e.preventDefault();
    try {
      await api.put('/parametros/costo_minuto', { valor: Number(v) });
      setMensaje({ tipo: 'ok', texto: 'Costo del minuto actualizado. Se aplica a los trabajos que se registren desde ahora.' });
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  return (
    <form className="bloque" onSubmit={guardar}>
      <h2>Costo del minuto de mano de obra</h2>
      <p className="nota">
        Sale de la hoja <em>salarios</em>: salario mínimo + transporte + seguridad social + prestaciones = costo mensual del empleador,
        dividido entre 14.400 minutos (30 días × 8 horas). Con el salario 2025 da {pesos(2761021.725)} al mes, es decir {num(191.74)} pesos por minuto.
      </p>
      <div className="rejilla">
        <label className="campo corto">
          <span>Pesos por minuto</span>
          <input type="number" min="0" step="any" value={v} onChange={(e) => setV(e.target.value)} required />
        </label>
        <div className="campo dato-calculado">
          <span>Equivale a</span>
          <strong>{pesos((Number(v) || 0) * 60)} por hora</strong>
        </div>
      </div>
      <button type="submit" className="boton-principal ajustado" disabled={Number(v) === valor}>Guardar costo del minuto</button>
      {mensaje && <div className={`aviso ${mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}`}>{mensaje.texto}</div>}
    </form>
  );
}

export default function EficienciaJC({ catalogos, recargar, irA }) {
  const filtros = useFiltrosJC();
  const { desde, hasta, query } = filtros;
  const [regs, setRegs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [verDetalle, setVerDetalle] = useState(false);

  useEffect(() => {
    setCargando(true);
    api.get('/jc/registros?' + query).then(setRegs).catch(() => setRegs([])).finally(() => setCargando(false));
  }, [query]);

  const total = useMemo(() => resumir(regs), [regs]);
  const porTrabajador = useMemo(() => agruparPor(regs, (r) => r.trabajador_id, (r) => r.trabajador).sort((a, b) => b.difCosto - a.difCosto), [regs]);
  const porFecha = useMemo(() => agruparPor(regs, (r) => r.fecha, (r) => fechaLarga(r.fecha)).sort((a, b) => (a.clave < b.clave ? 1 : -1)), [regs]);

  return (
    <div className="liquidacion">
      <FiltrosJC filtros={filtros} trabajadores={catalogos.trabajadores} />

      <section className="panel-total pespunte panel-eficiencia">
        <div className="panel-total-principal">
          <span>Resultado del periodo</span>
          <strong className="resultado-grande">{total.comparables ? <Etiqueta diferencia={total.difCosto} /> : '—'}</strong>
          <small>{desde ? fechaLarga(desde) : 'Inicio'} — {hasta ? fechaLarga(hasta) : 'hoy'} · eficiencia {pct(total.eficiencia)}</small>
        </div>
        <div className="comparativas">
          <dl className="comparativa">
            <dt>Tiempo</dt>
            <div><span>Estimado</span><strong>{minutosTexto(total.minEstimados)}</strong></div>
            <div><span>Real</span><strong>{minutosTexto(total.minReales)}</strong></div>
            <div><span>Diferencia</span><strong>{total.comparables ? signo(total.difMinutos, minutosTexto) : '—'}</strong></div>
          </dl>
          <dl className="comparativa">
            <dt>Costo</dt>
            <div><span>Estimado</span><strong>{pesos(total.costoEstimado)}</strong></div>
            <div><span>Real</span><strong>{pesos(total.costoReal)}</strong></div>
            <div><span>Diferencia</span><strong>{total.comparables ? signo(total.difCosto, pesos) : '—'}</strong></div>
          </dl>
        </div>
        <dl className="panel-total-datos">
          <div><dt>Registros comparados</dt><dd>{total.comparables} de {total.registros}</dd></div>
          <div><dt>Prendas</dt><dd>{num(total.prendas)}</dd></div>
          <div><dt>Pagado (mano de obra)</dt><dd>{pesos(total.pagado)}</dd></div>
        </dl>
      </section>

      <p className="nota nota-eficiencia">
        <strong>Cómo se calcula:</strong> tiempo estimado = tiempo estándar de cada operación × cantidad. Tiempo real = hora de fin − hora de inicio del registro.
        Costo = minutos × costo del minuto. Si el real no supera al estimado hay <strong>eficiencia</strong>; si lo supera, <strong>sobrecosto</strong>.
        Como tiempo y costo usan el mismo costo por minuto, los dos dan el mismo resultado.
      </p>

      {total.sinTiempo > 0 && (
        <div className="aviso aviso-alerta">
          {total.sinTiempo === 1 ? '1 registro no entra' : `${total.sinTiempo} registros no entran`} en la comparativa porque tienen operaciones sin tiempo estándar.
          {' '}<button type="button" className="boton-texto" onClick={() => irA('operaciones')}>Completar tiempos en Operaciones y valores</button>
        </div>
      )}

      {cargando && <p className="vacio">Cargando…</p>}
      {!cargando && !regs.length && <p className="vacio">No hay trabajos registrados en este rango. Cambia las fechas o los filtros.</p>}

      {regs.length > 0 && (
        <>
          <TablaComparativa titulo="Por trabajador" primeraColumna="Trabajador" filas={porTrabajador} />
          <TablaComparativa titulo="Por fecha" primeraColumna="Fecha" filas={porFecha} />

          <section className="bloque">
            <div className="cabecera-con-filtro">
              <h2>Detalle por registro</h2>
              <button type="button" className="boton-secundario sin-margen" aria-expanded={verDetalle} onClick={() => setVerDetalle((v) => !v)}>
                {verDetalle ? 'Ocultar detalle' : `Ver los ${regs.length} registros`}
              </button>
            </div>
            {verDetalle && (
              <div className="tabla-scroll">
                <table className="tabla tabla-compacta">
                  <thead>
                    <tr><th>Fecha</th><th>Trabajador</th><th>Prenda</th><th>Operaciones</th><th className="num">Cant.</th><th className="num">T. estimado</th><th className="num">T. real</th><th className="num">Costo estimado</th><th className="num">Costo real</th><th>Resultado</th></tr>
                  </thead>
                  <tbody>
                    {regs.map((r) => (
                      <tr key={r.id}>
                        <td>{fechaLarga(r.fecha)}<small className="sub">{r.hora_inicio}–{r.hora_fin}</small></td>
                        <td>{r.trabajador}</td>
                        <td>{r.prenda}{r.talla && <small className="sub">Talla {r.talla}</small>}</td>
                        <td>{r.operaciones.map((o) => (
                          <small className={`sub ${o.tiempo_estandar == null ? 'alerta' : ''}`} key={o.id}>
                            {o.codigo} {o.nombre}: {num(o.cantidad)} × {o.tiempo_estandar == null ? 'sin tiempo' : `${num(o.tiempo_estandar)} s`}
                          </small>
                        ))}</td>
                        <td className="num">{r.cantidad}</td>
                        <td className="num">{r.comparable ? minutosTexto(r.minutos_estimados) : '—'}</td>
                        <td className="num">{minutosTexto(r.minutos)}</td>
                        <td className="num">{r.comparable ? pesos(r.costo_estimado) : '—'}</td>
                        <td className="num">{pesos(r.costo_real)}</td>
                        <td><Etiqueta diferencia={r.costo_real - r.costo_estimado} comparable={r.comparable} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <CostoMinuto valor={catalogos.parametros?.costo_minuto} recargar={recargar} />
    </div>
  );
}
