import { useEffect, useMemo, useState } from 'react';
import { api, pesos, num, duracion, fechaLarga } from '../../api.js';
import { descargarCSV } from '../../rangos.js';
import FiltrosJC, { useFiltrosJC } from '../../components/FiltrosJC.jsx';
import { PROCESOS } from './RegistroJC.jsx';

function agrupar(regs) {
  const porTrab = new Map();
  for (const r of regs) {
    if (!porTrab.has(r.trabajador_id)) {
      porTrab.set(r.trabajador_id, { id: r.trabajador_id, nombre: r.trabajador, codigo: r.trabajador_codigo, tipo: r.tipo_trabajador, regs: [], total: 0, prendas: 0, minutos: 0, porPrenda: new Map(), porOp: new Map() });
    }
    const t = porTrab.get(r.trabajador_id);
    t.regs.push(r);
    t.total += r.total;
    t.prendas += r.cantidad;
    t.minutos += r.minutos;

    const kP = `${r.prenda}|${r.proceso}`;
    if (!t.porPrenda.has(kP)) t.porPrenda.set(kP, { prenda: r.prenda, proceso: r.proceso, prendas: 0, operaciones: 0, total: 0 });
    const p = t.porPrenda.get(kP);
    p.prendas += r.cantidad;
    p.operaciones += r.operaciones.length;
    p.total += r.total;

    for (const o of r.operaciones) {
      const kO = `${o.operacion_id}|${o.valor_unitario}`;
      if (!t.porOp.has(kO)) t.porOp.set(kO, { codigo: o.codigo, nombre: o.nombre, maquina: o.maquina, valor_unitario: o.valor_unitario, cantidad: 0, valor: 0 });
      const x = t.porOp.get(kO);
      x.cantidad += o.cantidad;
      x.valor += o.valor;
    }
  }
  return [...porTrab.values()].sort((a, b) => b.total - a.total);
}

function exportarCSV(regs, desde, hasta) {
  const cab = ['Fecha', 'Trabajador', 'Código', 'Tipo', 'Proceso', 'Hora inicio', 'Hora fin', 'Minutos', 'Doc', 'N.º orden', 'Orden compra', 'Cliente', 'Prenda', 'Talla', 'Prendas', 'Código operación', 'Operación', 'Máquina', 'Cantidad', 'Valor unitario', 'Valor'];
  // Una fila por operación para poder sumar y filtrar en Excel
  const filas = [...regs].reverse().flatMap((r) => r.operaciones.map((o) => [
    r.fecha, r.trabajador, r.trabajador_codigo, r.tipo_trabajador, PROCESOS[r.proceso], r.hora_inicio, r.hora_fin, r.minutos, r.tipo_doc, r.num_orden, r.orden_compra, r.cliente,
    r.prenda, r.talla, r.cantidad, o.codigo, o.nombre, o.maquina, o.cantidad, o.valor_unitario, o.valor,
  ]));
  descargarCSV(`liquidacion_jeans_chaquetas_${desde || 'inicio'}_a_${hasta || 'hoy'}.csv`, cab, filas);
}

export default function LiquidacionJC({ catalogos }) {
  const filtros = useFiltrosJC();
  const { desde, hasta, query } = filtros;
  const [regs, setRegs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abiertos, setAbiertos] = useState({});

  const cargar = () => {
    setCargando(true);
    api.get('/jc/registros?' + query).then(setRegs).catch(() => setRegs([])).finally(() => setCargando(false));
  };

  useEffect(cargar, [query]);

  const grupos = useMemo(() => agrupar(regs), [regs]);
  const totales = useMemo(() => ({
    total: regs.reduce((s, r) => s + r.total, 0),
    prendas: regs.reduce((s, r) => s + r.cantidad, 0),
    operaciones: regs.reduce((s, r) => s + r.operaciones.length, 0),
    minutos: regs.reduce((s, r) => s + r.minutos, 0),
  }), [regs]);

  const eliminar = async (r) => {
    if (!confirm(`¿Eliminar el trabajo de ${r.trabajador} del ${fechaLarga(r.fecha)} (${r.cantidad} × ${r.prenda})? No se puede deshacer.`)) return;
    await api.del(`/jc/registros/${r.id}`);
    cargar();
  };

  return (
    <div className="liquidacion">
      <FiltrosJC filtros={filtros} trabajadores={catalogos.trabajadores} />

      <section className="panel-total pespunte">
        <div className="panel-total-principal">
          <span>Total a liquidar · jeans y chaquetas</span>
          <strong>{pesos(totales.total)}</strong>
          <small>{desde ? fechaLarga(desde) : 'Inicio'} — {hasta ? fechaLarga(hasta) : 'hoy'}</small>
        </div>
        <dl className="panel-total-datos">
          <div><dt>Trabajadores</dt><dd>{grupos.length}</dd></div>
          <div><dt>Registros</dt><dd>{regs.length}</dd></div>
          <div><dt>Prendas</dt><dd>{num(totales.prendas)}</dd></div>
          <div><dt>Operaciones</dt><dd>{num(totales.operaciones)}</dd></div>
          <div><dt>Tiempo registrado</dt><dd>{duracion(totales.minutos)}</dd></div>
        </dl>
        <div className="panel-total-acciones">
          <button type="button" className="boton-claro" disabled={!regs.length} onClick={() => exportarCSV(regs, desde, hasta)}>Descargar para Excel</button>
          <button type="button" className="boton-claro" disabled={!regs.length} onClick={() => window.print()}>Imprimir</button>
        </div>
      </section>

      {cargando && <p className="vacio">Cargando trabajos…</p>}
      {!cargando && !regs.length && <p className="vacio">No hay trabajos registrados en este rango. Cambia las fechas o los filtros, o registra un trabajo nuevo.</p>}

      {grupos.length > 1 && (
        <section className="bloque">
          <h2>Total por trabajador</h2>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Trabajador</th><th>Tipo</th><th className="num">Registros</th><th className="num">Prendas</th><th className="num">Tiempo</th><th className="num">Total</th></tr></thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.id}>
                    <td><a href={`#jc-trab-${g.id}`}>{g.nombre}</a></td>
                    <td><span className={`etiqueta-tipo ${g.tipo === 'EXTERNO' ? 'externo' : 'interno'}`}>{g.tipo === 'EXTERNO' ? 'Externo' : 'Interno'}</span></td>
                    <td className="num">{g.regs.length}</td>
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
        <section className="bloque trabajador" key={g.id} id={`jc-trab-${g.id}`}>
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

          <h3>Por operación</h3>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th>Operación</th><th>Máquina</th><th className="num">Cantidad</th><th className="num">Valor c/u</th><th className="num">Total</th></tr></thead>
              <tbody>
                {[...g.porOp.values()].map((o) => (
                  <tr key={o.codigo + o.valor_unitario}>
                    <td><span className="codigo">{o.codigo}</span> {o.nombre}</td>
                    <td className="texto-suave">{o.maquina || '—'}</td>
                    <td className="num">{num(o.cantidad)}</td>
                    <td className="num">{pesos(o.valor_unitario)}</td>
                    <td className="num fuerte">{pesos(o.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan="4">Total de operaciones</td><td className="num">{pesos(g.total)}</td></tr></tfoot>
            </table>
          </div>

          <h3>Por prenda</h3>
          <div className="tabla-scroll">
            <table className="tabla tabla-compacta">
              <thead><tr><th>Prenda</th><th>Proceso</th><th className="num">Prendas</th><th className="num">Valor por prenda</th><th className="num">Total</th></tr></thead>
              <tbody>
                {[...g.porPrenda.values()].map((p) => (
                  <tr key={p.prenda + p.proceso}>
                    <td>{p.prenda}</td>
                    <td className="texto-suave">{PROCESOS[p.proceso]}</td>
                    <td className="num">{num(p.prendas)}</td>
                    <td className="num">{pesos(p.total / p.prendas)}</td>
                    <td className="num">{pesos(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="boton-secundario" aria-expanded={!!abiertos[g.id]} onClick={() => setAbiertos((x) => ({ ...x, [g.id]: !x[g.id] }))}>
            {abiertos[g.id] ? 'Ocultar registros' : g.regs.length === 1 ? 'Ver el registro' : `Ver los ${g.regs.length} registros`}
          </button>

          {abiertos[g.id] && (
            <div className="tabla-scroll">
              <table className="tabla tabla-compacta operaciones">
                <thead>
                  <tr><th>Fecha</th><th>Horario</th><th>Orden</th><th>Cliente / OC</th><th>Prenda</th><th>Talla</th><th className="num">Cant.</th><th>Operaciones</th><th className="num">Total</th><th /></tr>
                </thead>
                <tbody>
                  {g.regs.map((r) => (
                    <tr key={r.id}>
                      <td>{fechaLarga(r.fecha)}</td>
                      <td>{r.hora_inicio}–{r.hora_fin}<small className="sub">{duracion(r.minutos)}</small></td>
                      <td>{r.tipo_doc} {r.num_orden}</td>
                      <td>{r.cliente || '—'}{r.orden_compra && <small className="sub">OC cliente {r.orden_compra}</small>}</td>
                      <td>{r.prenda}<small className="sub">{PROCESOS[r.proceso]}{r.observaciones ? ` · ${r.observaciones}` : ''}</small></td>
                      <td>{r.talla || '—'}</td>
                      <td className="num">{r.cantidad}</td>
                      <td>{r.operaciones.map((o) => <small className="sub" key={o.id}>{o.codigo} {o.nombre}: {num(o.cantidad)} × {pesos(o.valor_unitario)}</small>)}</td>
                      <td className="num fuerte">{pesos(r.total)}</td>
                      <td><button type="button" className="boton-texto peligro" onClick={() => eliminar(r)}>Eliminar</button></td>
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
