import { useEffect, useMemo, useState } from 'react';
import { api, pesos, num, duracion, fechaLarga } from '../api.js';
import { RANGOS, ATAJOS, descargarCSV } from '../rangos.js';
import Buscador from '../components/Buscador.jsx';

function agrupar(ops) {
  const porTrab = new Map();
  for (const o of ops) {
    if (!porTrab.has(o.trabajador_id)) {
      porTrab.set(o.trabajador_id, { id: o.trabajador_id, nombre: o.trabajador, codigo: o.trabajador_codigo, tipo: o.tipo_trabajador, ops: [], total: 0, prendas: 0, minutos: 0, refs: new Map(), adics: new Map() });
    }
    const t = porTrab.get(o.trabajador_id);
    t.ops.push(o);
    t.total += o.total;
    t.prendas += o.cantidad;
    t.minutos += o.minutos;

    const kRef = `${o.prenda_id}|${o.tarifa_prenda}`;
    if (!t.refs.has(kRef)) t.refs.set(kRef, { codigo: o.prenda_codigo, nombre: o.prenda, tarifa: o.tarifa_prenda, prendas: 0, valorPrendas: 0, valorAdic: 0, total: 0 });
    const r = t.refs.get(kRef);
    r.prendas += o.cantidad;
    r.valorPrendas += o.valor_prendas;
    r.valorAdic += o.valor_adicionales;
    r.total += o.total;

    for (const a of o.adicionales) {
      const kA = `${a.adicional_id}|${a.tarifa}`;
      if (!t.adics.has(kA)) t.adics.set(kA, { codigo: a.codigo, nombre: a.nombre, tarifa: a.tarifa, unidades: 0, valor: 0 });
      const x = t.adics.get(kA);
      x.unidades += a.cantidad_por_prenda * a.prendas;
      x.valor += a.valor;
    }
  }
  return [...porTrab.values()].sort((a, b) => b.total - a.total);
}

function exportarCSV(ops, desde, hasta) {
  const cab = ['Fecha', 'Trabajador', 'Código', 'Tipo', 'Hora inicio', 'Hora fin', 'Minutos', 'Doc', 'N.º orden', 'Orden compra', 'Cliente', 'Código prenda', 'Prenda', 'Talla', 'Cantidad', 'Tarifa prenda', 'Valor prendas', 'Adicionales', 'Valor adicionales', 'Total'];
  const filas = [...ops].reverse().map((o) => [
    o.fecha, o.trabajador, o.trabajador_codigo, o.tipo_trabajador, o.hora_inicio, o.hora_fin, o.minutos, o.tipo_doc, o.num_orden, o.orden_compra, o.cliente,
    o.prenda_codigo, o.prenda, o.talla, o.cantidad, o.tarifa_prenda, o.valor_prendas,
    o.adicionales.map((a) => `${a.nombre} (${a.cantidad_por_prenda}×${a.prendas}×${a.tarifa})`).join(' | '),
    o.valor_adicionales, o.total,
  ]);
  descargarCSV(`liquidacion_livianas_${desde || 'inicio'}_a_${hasta || 'hoy'}.csv`, cab, filas);
}

export default function Liquidacion({ catalogos }) {
  const [rango, setRango] = useState(RANGOS.quincena);
  const [atajo, setAtajo] = useState('quincena');
  const [tipo, setTipo] = useState('');
  const [trabajadorId, setTrabajadorId] = useState(null);
  const [ops, setOps] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abiertos, setAbiertos] = useState({});
  const [desde, hasta] = rango;

  const cargar = () => {
    const q = new URLSearchParams();
    if (desde) q.set('desde', desde);
    if (hasta) q.set('hasta', hasta);
    if (tipo) q.set('tipo', tipo);
    if (trabajadorId) q.set('trabajador_id', trabajadorId);
    setCargando(true);
    api.get('/operaciones?' + q).then(setOps).catch(() => setOps([])).finally(() => setCargando(false));
  };

  useEffect(cargar, [desde, hasta, tipo, trabajadorId]);

  const grupos = useMemo(() => agrupar(ops), [ops]);
  const totales = useMemo(() => ({
    total: ops.reduce((s, o) => s + o.total, 0),
    prendas: ops.reduce((s, o) => s + o.cantidad, 0),
    minutos: ops.reduce((s, o) => s + o.minutos, 0),
  }), [ops]);

  const opcionesTrab = useMemo(
    () => catalogos.trabajadores
      .filter((t) => !tipo || t.tipo === tipo)
      .map((t) => ({ id: t.id, etiqueta: t.nombre, detalle: t.codigo, grupo: t.tipo === 'INTERNO' ? 'Operarios internos' : 'Talleres externos', busqueda: `${t.nombre} ${t.codigo}` })),
    [catalogos.trabajadores, tipo],
  );

  const eliminar = async (o) => {
    if (!confirm(`¿Eliminar la operación de ${o.trabajador} del ${fechaLarga(o.fecha)} (${o.cantidad} × ${o.prenda})? No se puede deshacer.`)) return;
    await api.del(`/operaciones/${o.id}`);
    cargar();
  };

  const usarAtajo = (k) => { setAtajo(k); setRango(RANGOS[k]()); };
  const cambiarFecha = (i) => (e) => { setAtajo(''); setRango((r) => (i === 0 ? [e.target.value, r[1]] : [r[0], e.target.value])); };

  return (
    <div className="liquidacion">
      <section className="filtros bloque">
        <div className="filtros-fila">
          <label className="campo">
            <span>Desde</span>
            <input type="date" value={desde} max={hasta || undefined} onChange={cambiarFecha(0)} />
          </label>
          <label className="campo">
            <span>Hasta</span>
            <input type="date" value={hasta} min={desde || undefined} onChange={cambiarFecha(1)} />
          </label>
          <div className="campo">
            <span>Trabajadores</span>
            <div className="segmentado">
              {[['', 'Todos'], ['INTERNO', 'Internos'], ['EXTERNO', 'Externos']].map(([v, n]) => (
                <button type="button" key={n} className={tipo === v ? 'activo' : ''} aria-pressed={tipo === v}
                  onClick={() => { setTipo(v); if (v && catalogos.trabajadores.find((t) => t.id === trabajadorId)?.tipo !== v) setTrabajadorId(null); }}>{n}</button>
              ))}
            </div>
          </div>
          <label className="campo campo-trab">
            <span>Trabajador</span>
            <div className="con-limpiar">
              <Buscador opciones={opcionesTrab} valor={trabajadorId} onChange={setTrabajadorId} placeholder="Todos los trabajadores" />
              {trabajadorId && <button type="button" className="boton-texto" onClick={() => setTrabajadorId(null)}>Quitar</button>}
            </div>
          </label>
        </div>
        <div className="atajos">
          {ATAJOS.map(([k, n]) => (
            <button type="button" key={k} className={atajo === k ? 'chip activo' : 'chip'} onClick={() => usarAtajo(k)}>{n}</button>
          ))}
        </div>
      </section>

      <section className="panel-total pespunte">
        <div className="panel-total-principal">
          <span>Total a liquidar</span>
          <strong>{pesos(totales.total)}</strong>
          <small>{desde ? fechaLarga(desde) : 'Inicio'} — {hasta ? fechaLarga(hasta) : 'hoy'}</small>
        </div>
        <dl className="panel-total-datos">
          <div><dt>Trabajadores</dt><dd>{grupos.length}</dd></div>
          <div><dt>Operaciones</dt><dd>{ops.length}</dd></div>
          <div><dt>Prendas</dt><dd>{num(totales.prendas)}</dd></div>
          <div><dt>Tiempo registrado</dt><dd>{duracion(totales.minutos)}</dd></div>
        </dl>
        <div className="panel-total-acciones">
          <button type="button" className="boton-claro" disabled={!ops.length} onClick={() => exportarCSV(ops, desde, hasta)}>Descargar para Excel</button>
          <button type="button" className="boton-claro" disabled={!ops.length} onClick={() => window.print()}>Imprimir</button>
        </div>
      </section>

      {cargando && <p className="vacio">Cargando operaciones…</p>}
      {!cargando && !ops.length && <p className="vacio">No hay operaciones registradas en este rango. Cambia las fechas o los filtros, o registra una operación nueva.</p>}

      {grupos.length > 1 && (
        <section className="bloque">
          <h2>Total por trabajador</h2>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Trabajador</th><th>Tipo</th><th className="num">Operaciones</th><th className="num">Prendas</th><th className="num">Tiempo</th><th className="num">Total</th></tr></thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.id}>
                    <td><a href={`#trab-${g.id}`}>{g.nombre}</a></td>
                    <td><span className={`etiqueta-tipo ${g.tipo === 'EXTERNO' ? 'externo' : 'interno'}`}>{g.tipo === 'EXTERNO' ? 'Externo' : 'Interno'}</span></td>
                    <td className="num">{g.ops.length}</td>
                    <td className="num">{num(g.prendas)}</td>
                    <td className="num">{duracion(g.minutos)}</td>
                    <td className="num fuerte">{pesos(g.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan="3">Total</td><td className="num">{num(totales.prendas)}</td><td className="num">{duracion(totales.minutos)}</td><td className="num">{pesos(totales.total)}</td></tr></tfoot>
            </table>
          </div>
        </section>
      )}

      {grupos.map((g) => (
        <section className="bloque trabajador" key={g.id} id={`trab-${g.id}`}>
          <header className="trabajador-cabecera">
            <div>
              <h2>{g.nombre}</h2>
              <span className={`etiqueta-tipo ${g.tipo === 'EXTERNO' ? 'externo' : 'interno'}`}>{g.codigo} · {g.tipo === 'EXTERNO' ? 'Taller externo' : 'Operario interno'}</span>
            </div>
            <div className="trabajador-total">
              <span>Total a pagar</span>
              <strong>{pesos(g.total)}</strong>
            </div>
          </header>

          <h3>Por referencia</h3>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Referencia</th><th className="num">Prendas</th><th className="num">Tarifa</th><th className="num">Valor prendas</th><th className="num">Adicionales</th><th className="num">Total</th></tr></thead>
              <tbody>
                {[...g.refs.values()].map((r) => (
                  <tr key={r.codigo + r.tarifa}>
                    <td><span className="codigo">{r.codigo}</span> {r.nombre}</td>
                    <td className="num">{num(r.prendas)}</td>
                    <td className="num">{pesos(r.tarifa)}</td>
                    <td className="num">{pesos(r.valorPrendas)}</td>
                    <td className="num">{pesos(r.valorAdic)}</td>
                    <td className="num fuerte">{pesos(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Total de todas las prendas</td><td className="num">{num(g.prendas)}</td><td /><td className="num">{pesos([...g.refs.values()].reduce((s, r) => s + r.valorPrendas, 0))}</td><td className="num">{pesos([...g.refs.values()].reduce((s, r) => s + r.valorAdic, 0))}</td><td className="num">{pesos(g.total)}</td></tr></tfoot>
            </table>
          </div>

          {g.adics.size > 0 && (
            <>
              <h3>Detalle de adicionales</h3>
              <div className="tabla-scroll">
                <table className="tabla tabla-compacta">
                  <thead><tr><th>Adicional</th><th className="num">Unidades</th><th className="num">Tarifa</th><th className="num">Valor</th></tr></thead>
                  <tbody>
                    {[...g.adics.values()].map((a) => (
                      <tr key={a.codigo + a.tarifa}><td><span className="codigo">{a.codigo}</span> {a.nombre}</td><td className="num">{num(a.unidades)}</td><td className="num">{pesos(a.tarifa)}</td><td className="num">{pesos(a.valor)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <button type="button" className="boton-secundario" aria-expanded={!!abiertos[g.id]} onClick={() => setAbiertos((x) => ({ ...x, [g.id]: !x[g.id] }))}>
            {abiertos[g.id] ? 'Ocultar operaciones' : g.ops.length === 1 ? 'Ver la operación' : `Ver las ${g.ops.length} operaciones`}
          </button>

          {abiertos[g.id] && (
            <div className="tabla-scroll">
              <table className="tabla tabla-compacta operaciones">
                <thead>
                  <tr><th>Fecha</th><th>Horario</th><th>Orden</th><th>Cliente / OC</th><th>Prenda</th><th>Talla</th><th className="num">Cant.</th><th className="num">Prendas</th><th className="num">Adicionales</th><th className="num">Total</th><th /></tr>
                </thead>
                <tbody>
                  {g.ops.map((o) => (
                    <tr key={o.id}>
                      <td>{fechaLarga(o.fecha)}</td>
                      <td>{o.hora_inicio}–{o.hora_fin}<small className="sub">{duracion(o.minutos)}</small></td>
                      <td>{o.tipo_doc} {o.num_orden}</td>
                      <td>{o.cliente || '—'}{o.orden_compra && <small className="sub">OC cliente {o.orden_compra}</small>}</td>
                      <td>{o.prenda}{o.observaciones && <small className="sub">{o.observaciones}</small>}</td>
                      <td>{o.talla || '—'}</td>
                      <td className="num">{o.cantidad}</td>
                      <td className="num">{pesos(o.valor_prendas)}<small className="sub">{o.cantidad} × {pesos(o.tarifa_prenda)}</small></td>
                      <td className="num">
                        {pesos(o.valor_adicionales)}
                        {o.adicionales.map((a) => <small className="sub" key={a.id}>{a.nombre}: {num(a.cantidad_por_prenda)}×{a.prendas}</small>)}
                      </td>
                      <td className="num fuerte">{pesos(o.total)}</td>
                      <td><button type="button" className="boton-texto peligro" onClick={() => eliminar(o)}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
