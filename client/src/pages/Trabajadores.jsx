import { useEffect, useState } from 'react';
import { api } from '../api.js';

const vacio = { tipo: 'INTERNO', codigo: '', nombre: '', especialidad: '' };

// La lista de trabajadores es una sola; cada uno se marca en las secciones donde trabaja
export const SECCIONES_TRAB = { livianas: 'Prendas livianas', jean: 'Jeans y chaquetas' };

export default function Trabajadores({ trabajadores, recargar, seccion = 'livianas' }) {
  const [nuevo, setNuevo] = useState(vacio);
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  // Sugerir el siguiente código según el tipo (OI005, TE011…)
  useEffect(() => {
    api.get(`/siguiente-codigo/${nuevo.tipo === 'INTERNO' ? 'OI' : 'TE'}`).then((r) => setNuevo((n) => ({ ...n, codigo: r.codigo }))).catch(() => {});
  }, [nuevo.tipo, trabajadores.length]);

  const crear = async (e) => {
    e.preventDefault();
    try {
      const t = await api.post('/trabajadores', {
        ...nuevo, nombre: nuevo.nombre.trim().toUpperCase(), especialidad: nuevo.especialidad.trim().toUpperCase(), activo: 1,
        livianas: seccion === 'livianas' ? 1 : 0, jean: seccion === 'jean' ? 1 : 0,
      });
      setMensaje({ tipo: 'ok', texto: `${t.nombre} agregado como ${t.tipo === 'INTERNO' ? 'operario interno' : 'taller externo'} en ${SECCIONES_TRAB[seccion]}.` });
      setNuevo({ ...vacio, tipo: nuevo.tipo });
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const guardarEdicion = async () => {
    try {
      await api.put(`/trabajadores/${editando.id}`, { nombre: editando.nombre.trim().toUpperCase(), especialidad: editando.especialidad.trim().toUpperCase(), tipo: editando.tipo });
      setEditando(null);
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const alternar = async (t, campo) => {
    await api.put(`/trabajadores/${t.id}`, { [campo]: t[campo] ? 0 : 1 });
    recargar();
  };

  const lista = trabajadores.filter((t) => (!filtro || t.tipo === filtro) && (verTodos || t[seccion]));

  return (
    <div className="catalogo">
      <form className="bloque" onSubmit={crear}>
        <h2>Agregar trabajador a {SECCIONES_TRAB[seccion].toLowerCase()}</h2>
        <div className="rejilla">
          <div className="campo">
            <span>Tipo</span>
            <div className="segmentado">
              {[['INTERNO', 'Operario interno'], ['EXTERNO', 'Taller externo']].map(([v, n]) => (
                <button type="button" key={v} className={nuevo.tipo === v ? 'activo' : ''} aria-pressed={nuevo.tipo === v} onClick={() => setNuevo((x) => ({ ...x, tipo: v }))}>{n}</button>
              ))}
            </div>
          </div>
          <label className="campo corto">
            <span>Código</span>
            <input value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })} required />
          </label>
          <label className="campo">
            <span>{nuevo.tipo === 'INTERNO' ? 'Nombre del operario' : 'Nombre del taller'}</span>
            <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
          </label>
          <label className="campo ancho-2">
            <span>Especialidad o prendas</span>
            <input value={nuevo.especialidad} onChange={(e) => setNuevo({ ...nuevo, especialidad: e.target.value })} placeholder={seccion === 'jean' ? 'Ej. PANTALON JEAN, CHAQUETAS JEAN' : 'Ej. CAMISAS, BLUSAS, POLOS'} />
          </label>
        </div>
        <button type="submit" className="boton-principal ajustado">Agregar trabajador</button>
        {mensaje && <div className={`aviso ${mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}`}>{mensaje.texto}</div>}
      </form>

      <section className="bloque">
        <div className="cabecera-con-filtro">
          <h2>{verTodos ? 'Todos los trabajadores' : `Trabajadores de ${SECCIONES_TRAB[seccion].toLowerCase()}`}</h2>
          <div className="filtros-en-linea">
            <div className="segmentado">
              {[[false, 'De esta sección'], [true, 'Todos']].map(([v, n]) => (
                <button type="button" key={n} className={verTodos === v ? 'activo' : ''} aria-pressed={verTodos === v} onClick={() => setVerTodos(v)}>{n}</button>
              ))}
            </div>
            <div className="segmentado">
              {[['', 'Todos'], ['INTERNO', 'Internos'], ['EXTERNO', 'Externos']].map(([v, n]) => (
                <button type="button" key={n} className={filtro === v ? 'activo' : ''} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{n}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Especialidad</th><th>Secciones</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {lista.map((t) => (editando?.id === t.id ? (
                <tr key={t.id} className="fila-edicion">
                  <td>{t.codigo}</td>
                  <td><input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></td>
                  <td>
                    <select value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value })}>
                      <option value="INTERNO">Interno</option>
                      <option value="EXTERNO">Externo</option>
                    </select>
                  </td>
                  <td><input value={editando.especialidad || ''} onChange={(e) => setEditando({ ...editando, especialidad: e.target.value })} /></td>
                  <td />
                  <td />
                  <td className="acciones">
                    <button type="button" className="boton-texto" onClick={guardarEdicion}>Guardar</button>
                    <button type="button" className="boton-texto" onClick={() => setEditando(null)}>Cancelar</button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className={t.activo ? '' : 'inactivo'}>
                  <td className="codigo">{t.codigo}</td>
                  <td>{t.nombre}</td>
                  <td><span className={`etiqueta-tipo ${t.tipo === 'EXTERNO' ? 'externo' : 'interno'}`}>{t.tipo === 'EXTERNO' ? 'Externo' : 'Interno'}</span></td>
                  <td className="texto-suave">{t.especialidad}</td>
                  <td className="secciones">
                    {Object.entries(SECCIONES_TRAB).map(([k, n]) => (
                      <label key={k} className="casilla">
                        <input type="checkbox" checked={!!t[k]} onChange={() => alternar(t, k)} />
                        {n}
                      </label>
                    ))}
                  </td>
                  <td>{t.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="acciones">
                    <button type="button" className="boton-texto" onClick={() => setEditando({ ...t })}>Editar</button>
                    <button type="button" className="boton-texto" onClick={() => alternar(t, 'activo')}>{t.activo ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <p className="nota">La lista de trabajadores es la misma para todo; marca las secciones donde trabaja cada uno para que aparezca al registrar. Los inactivos no aparecen al registrar, pero sus liquidaciones anteriores se conservan.</p>
      </section>
    </div>
  );
}
