import { useMemo, useState } from 'react';
import { RANGOS, ATAJOS } from '../rangos.js';
import Buscador from './Buscador.jsx';
import { PROCESOS } from '../pages/jc/RegistroJC.jsx';

// Filtros de jeans y chaquetas (fechas, proceso, internos/externos, trabajador), compartidos por Liquidación y Eficiencia
export function useFiltrosJC() {
  const [rango, setRango] = useState(RANGOS.quincena);
  const [atajo, setAtajo] = useState('quincena');
  const [proceso, setProceso] = useState('');
  const [tipo, setTipo] = useState('');
  const [trabajadorId, setTrabajadorId] = useState(null);
  const [desde, hasta] = rango;

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (desde) q.set('desde', desde);
    if (hasta) q.set('hasta', hasta);
    if (tipo) q.set('tipo', tipo);
    if (proceso) q.set('proceso', proceso);
    if (trabajadorId) q.set('trabajador_id', trabajadorId);
    return q.toString();
  }, [desde, hasta, tipo, proceso, trabajadorId]);

  return { desde, hasta, query, estado: { rango, setRango, atajo, setAtajo, proceso, setProceso, tipo, setTipo, trabajadorId, setTrabajadorId } };
}

export default function FiltrosJC({ filtros, trabajadores }) {
  const { rango, setRango, atajo, setAtajo, proceso, setProceso, tipo, setTipo, trabajadorId, setTrabajadorId } = filtros.estado;
  const [desde, hasta] = rango;

  const opcionesTrab = useMemo(
    () => trabajadores
      .filter((t) => t.jean && (!tipo || t.tipo === tipo))
      .map((t) => ({ id: t.id, etiqueta: t.nombre, detalle: t.codigo, grupo: t.tipo === 'INTERNO' ? 'Operarios internos' : 'Talleres externos', busqueda: `${t.nombre} ${t.codigo}` })),
    [trabajadores, tipo],
  );

  const usarAtajo = (k) => { setAtajo(k); setRango(RANGOS[k]()); };
  const cambiarFecha = (i) => (e) => { setAtajo(''); setRango((r) => (i === 0 ? [e.target.value, r[1]] : [r[0], e.target.value])); };

  return (
    <section className="filtros bloque">
      <div className="filtros-fila filtros-jc">
        <label className="campo">
          <span>Desde</span>
          <input type="date" value={desde} max={hasta || undefined} onChange={cambiarFecha(0)} />
        </label>
        <label className="campo">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={cambiarFecha(1)} />
        </label>
        <div className="campo">
          <span>Proceso</span>
          <div className="segmentado">
            {[['', 'Todos'], ...Object.entries(PROCESOS)].map(([v, n]) => (
              <button type="button" key={n} className={proceso === v ? 'activo' : ''} aria-pressed={proceso === v} onClick={() => setProceso(v)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span>Trabajadores</span>
          <div className="segmentado">
            {[['', 'Todos'], ['INTERNO', 'Internos'], ['EXTERNO', 'Externos']].map(([v, n]) => (
              <button type="button" key={n} className={tipo === v ? 'activo' : ''} aria-pressed={tipo === v}
                onClick={() => { setTipo(v); if (v && trabajadores.find((t) => t.id === trabajadorId)?.tipo !== v) setTrabajadorId(null); }}>{n}</button>
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
  );
}
