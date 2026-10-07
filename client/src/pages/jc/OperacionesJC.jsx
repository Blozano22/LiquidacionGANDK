import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { CeldaTarifa } from '../Tarifas.jsx';
import { PROCESOS } from './RegistroJC.jsx';

const vacio = { proceso: 'JEAN', codigo: '', nombre: '', area: '', maquina: '', valor: '', tiempo_estandar: '', nota: '' };

// Texto que se guarda al salir del campo (máquina de una operación existente)
function CeldaTexto({ valor, onGuardar, lista, etiqueta = 'Máquina o herramienta', vacio = 'Sin máquina' }) {
  const [v, setV] = useState(valor || '');
  useEffect(() => setV(valor || ''), [valor]);
  return (
    <input
      className="input-tarifa input-texto"
      value={v}
      list={lista}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== (valor || '') && onGuardar(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label={etiqueta}
      placeholder={vacio}
    />
  );
}

export default function OperacionesJC({ operaciones, recargar }) {
  const [nuevo, setNuevo] = useState(vacio);
  const [proceso, setProceso] = useState('');
  const [buscar, setBuscar] = useState('');
  const [mensaje, setMensaje] = useState(null);

  // Código sugerido según el proceso: OPR082 (jean), OCH001 (chaqueta)
  useEffect(() => {
    api.get(`/jc/siguiente-codigo/${nuevo.proceso}`).then((r) => setNuevo((n) => ({ ...n, codigo: r.codigo }))).catch(() => {});
  }, [nuevo.proceso, operaciones.length]);

  const maquinas = [...new Set(operaciones.map((o) => o.maquina).filter(Boolean))].sort();
  const areas = [...new Set(operaciones.map((o) => o.area).filter(Boolean))];
  const sinTiempo = operaciones.filter((o) => o.activo && o.tiempo_estandar == null).length;

  const actualizar = async (op, cambios) => {
    try {
      await api.put(`/jc/operaciones/${op.id}`, cambios);
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const crear = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/jc/operaciones', {
        codigo: nuevo.codigo, nombre: nuevo.nombre.trim(), proceso: nuevo.proceso, area: nuevo.area.trim(), maquina: nuevo.maquina.trim(),
        valor: Number(nuevo.valor) || 0, tiempo_estandar: nuevo.tiempo_estandar === '' ? null : Number(nuevo.tiempo_estandar), nota: nuevo.nota.trim() || null, activo: 1,
      });
      setMensaje({ tipo: 'ok', texto: `${r.codigo} · ${r.nombre} agregada a ${PROCESOS[r.proceso].toLowerCase()}.` });
      setNuevo({ ...vacio, proceso: nuevo.proceso });
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const q = buscar.toLowerCase();
  const items = operaciones.filter((o) => (!proceso || o.proceso === proceso) && (!q || `${o.codigo} ${o.nombre} ${o.maquina} ${o.area}`.toLowerCase().includes(q)));
  const cuenta = (p) => operaciones.filter((o) => o.proceso === p).length;

  return (
    <div className="catalogo">
      <form className="bloque" onSubmit={crear}>
        <h2>Crear operación</h2>
        <div className="rejilla">
          <div className="campo">
            <span>Proceso</span>
            <div className="segmentado">
              {Object.entries(PROCESOS).map(([k, n]) => (
                <button type="button" key={k} className={nuevo.proceso === k ? 'activo' : ''} aria-pressed={nuevo.proceso === k} onClick={() => setNuevo((x) => ({ ...x, proceso: k }))}>{n}</button>
              ))}
            </div>
          </div>
          <label className="campo corto">
            <span>Código</span>
            <input value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })} required />
          </label>
          <label className="campo ancho-2">
            <span>Nombre de la operación</span>
            <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej. Pegue de cuello chaqueta" required />
          </label>
          <label className="campo">
            <span>Área</span>
            <input value={nuevo.area} onChange={(e) => setNuevo({ ...nuevo, area: e.target.value })} list="lista-areas" placeholder="Ej. Parte delantera" />
          </label>
          <label className="campo">
            <span>Máquina o herramienta</span>
            <input value={nuevo.maquina} onChange={(e) => setNuevo({ ...nuevo, maquina: e.target.value })} list="lista-maquinas" placeholder="Ej. Plana, Sobrehilo, Dos agujas" />
          </label>
          <label className="campo corto">
            <span>Valor por operación</span>
            <input type="number" min="0" step="any" value={nuevo.valor} onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })} required />
          </label>
          <label className="campo corto">
            <span>Tiempo estándar (seg.)</span>
            <input type="number" min="0" step="any" value={nuevo.tiempo_estandar} onChange={(e) => setNuevo({ ...nuevo, tiempo_estandar: e.target.value })} placeholder="Opcional" title="Segundos por unidad, del estudio de tiempos" />
          </label>
          <label className="campo">
            <span>Observación</span>
            <input value={nuevo.nota} onChange={(e) => setNuevo({ ...nuevo, nota: e.target.value })} placeholder="Opcional, ej. Tomar tiempo" />
          </label>
        </div>
        <datalist id="lista-maquinas">{maquinas.map((m) => <option key={m} value={m} />)}</datalist>
        <datalist id="lista-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
        <button type="submit" className="boton-principal ajustado">Crear operación</button>
        {mensaje && <div className={`aviso ${mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}`}>{mensaje.texto}</div>}
      </form>

      <section className="bloque">
        <div className="cabecera-con-filtro">
          <h2>Operaciones y valores</h2>
          <div className="filtros-en-linea">
            <div className="segmentado">
              {[['', `Todas (${operaciones.length})`], ...Object.entries(PROCESOS).map(([k, n]) => [k, `${n} (${cuenta(k)})`])].map(([v, n]) => (
                <button type="button" key={v || 'todas'} className={proceso === v ? 'activo' : ''} aria-pressed={proceso === v} onClick={() => setProceso(v)}>{n}</button>
              ))}
            </div>
            <input className="buscar" type="search" placeholder="Buscar por código, nombre, área o máquina" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </div>
        </div>
        <p className="nota">Cambia el valor o la máquina y sal del campo para guardarlo. Los trabajos ya registrados conservan el valor con el que se liquidaron. Las operaciones con valor pendiente quedan inactivas hasta que les pongas valor y las actives.
          El tiempo estándar (segundos por unidad) se usa en <em>Eficiencia y costos</em>{sinTiempo > 0 && <>; hay <strong>{sinTiempo} operaciones activas sin tiempo</strong>, y los trabajos que las incluyan no entran en la comparativa</>}.</p>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Código</th><th>Operación</th><th>Proceso</th><th>Área</th><th>Máquina / herramienta</th><th className="num">Valor</th><th className="num">T. estándar (s)</th><th>Estado</th></tr></thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className={o.activo ? '' : 'inactivo'}>
                  <td className="codigo">{o.codigo}</td>
                  <td>{o.nombre}{o.nota && <small className="sub alerta">{o.nota}</small>}</td>
                  <td className="texto-suave">{PROCESOS[o.proceso]}</td>
                  <td><CeldaTexto valor={o.area} lista="lista-areas" etiqueta="Área" vacio="Sin área" onGuardar={(a) => actualizar(o, { area: a })} /></td>
                  <td><CeldaTexto valor={o.maquina} lista="lista-maquinas" onGuardar={(m) => actualizar(o, { maquina: m })} /></td>
                  <td className="num"><CeldaTarifa valor={o.valor} onGuardar={(n) => actualizar(o, { valor: n })} /></td>
                  <td className="num"><CeldaTarifa valor={o.tiempo_estandar ?? ''} vacio="Sin medir" onGuardar={(n) => actualizar(o, { tiempo_estandar: n })} /></td>
                  <td>
                    <button type="button" className="boton-texto" onClick={() => actualizar(o, { activo: o.activo ? 0 : 1, ...(o.nota === 'Valor pendiente' && !o.activo ? { nota: null } : {}) })}>
                      {o.activo ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && <p className="vacio">No hay operaciones que coincidan.</p>}
      </section>
    </div>
  );
}
