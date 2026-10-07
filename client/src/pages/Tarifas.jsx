import { useEffect, useState } from 'react';
import { api, pesos } from '../api.js';

export function CeldaTarifa({ valor, onGuardar, vacio }) {
  const [v, setV] = useState(valor);
  const [estado, setEstado] = useState('');
  useEffect(() => setV(valor), [valor]);
  const guardar = async () => {
    // Un campo vacío no se guarda como 0 (p. ej. tiempo estándar sin medir)
    if (String(v).trim() === '') { setV(valor); return; }
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) { setV(valor); return; }
    if (n === valor) return;
    await onGuardar(n);
    setEstado('guardado');
    setTimeout(() => setEstado(''), 1200);
  };
  return (
    <input
      className={`input-tarifa ${estado}`}
      type="number"
      min="0"
      step="any"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label="Tarifa"
      placeholder={vacio}
    />
  );
}

export default function Tarifas({ prendas, adicionales, recargar }) {
  const [vista, setVista] = useState('prendas');
  const [buscar, setBuscar] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const esPrendas = vista === 'prendas';
  const vacio = { codigo: '', nombre: '', categoria: 'Adicional', tarifa_interna: '', tarifa_externa: '', nota: '' };
  const [nuevo, setNuevo] = useState(vacio);
  const ruta = esPrendas ? 'prendas' : 'adicionales';

  useEffect(() => {
    const prefijo = esPrendas ? 'P' : nuevo.categoria === 'Operación jean' ? 'OPR' : 'O';
    api.get(`/siguiente-codigo/${prefijo}`).then((r) => setNuevo((n) => ({ ...n, codigo: r.codigo }))).catch(() => {});
  }, [vista, nuevo.categoria, prendas.length, adicionales.length]);

  const actualizar = async (item, cambios) => {
    try {
      await api.put(`/${ruta}/${item.id}`, cambios);
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const crear = async (e) => {
    e.preventDefault();
    const interna = Number(nuevo.tarifa_interna) || 0;
    const externa = nuevo.tarifa_externa === '' ? interna : Number(nuevo.tarifa_externa);
    try {
      const datos = { codigo: nuevo.codigo, nombre: nuevo.nombre.trim().toUpperCase(), tarifa_interna: interna, tarifa_externa: externa, activo: 1 };
      if (!esPrendas) Object.assign(datos, { categoria: nuevo.categoria, nota: nuevo.nota || null });
      const r = await api.post(`/${ruta}`, datos);
      setMensaje({ tipo: 'ok', texto: `${r.codigo} · ${r.nombre} agregado.` });
      setNuevo({ ...vacio, categoria: nuevo.categoria });
      recargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const items = (esPrendas ? prendas : adicionales).filter((i) => !buscar || `${i.codigo} ${i.nombre}`.toLowerCase().includes(buscar.toLowerCase()));
  const categorias = [...new Set(adicionales.map((a) => a.categoria))];

  return (
    <div className="catalogo">
      <div className="segmentado grande">
        <button type="button" className={esPrendas ? 'activo' : ''} aria-pressed={esPrendas} onClick={() => { setVista('prendas'); setMensaje(null); }}>Prendas ({prendas.length})</button>
        <button type="button" className={!esPrendas ? 'activo' : ''} aria-pressed={!esPrendas} onClick={() => { setVista('adicionales'); setMensaje(null); }}>Adicionales ({adicionales.length})</button>
      </div>

      <form className="bloque" onSubmit={crear}>
        <h2>{esPrendas ? 'Agregar prenda' : 'Agregar adicional'}</h2>
        <div className="rejilla">
          {!esPrendas && (
            <label className="campo">
              <span>Categoría</span>
              <input list="cats" value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} required />
              <datalist id="cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
          )}
          <label className="campo corto">
            <span>Código</span>
            <input value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })} required />
          </label>
          <label className="campo ancho-2">
            <span>{esPrendas ? 'Nombre de la prenda' : 'Nombre del adicional'}</span>
            <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder={esPrendas ? 'Ej. CAMISA DRIL MANGA CORTA' : 'Ej. MONTE DE BOLSILLO'} required />
          </label>
          <label className="campo corto">
            <span>Tarifa interna</span>
            <input type="number" min="0" step="any" value={nuevo.tarifa_interna} onChange={(e) => setNuevo({ ...nuevo, tarifa_interna: e.target.value })} required />
          </label>
          <label className="campo corto">
            <span>Tarifa externa</span>
            <input type="number" min="0" step="any" value={nuevo.tarifa_externa} placeholder={esPrendas ? '' : 'Igual a interna'} onChange={(e) => setNuevo({ ...nuevo, tarifa_externa: e.target.value })} required={esPrendas} />
          </label>
        </div>
        <button type="submit" className="boton-principal ajustado">{esPrendas ? 'Agregar prenda' : 'Agregar adicional'}</button>
        {mensaje && <div className={`aviso ${mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}`}>{mensaje.texto}</div>}
      </form>

      <section className="bloque">
        <div className="cabecera-con-filtro">
          <h2>{esPrendas ? 'Tarifas por prenda' : 'Tarifas de adicionales'}</h2>
          <input className="buscar" type="search" placeholder="Buscar por código o nombre" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <p className="nota">Cambia el valor y sal del campo para guardarlo. Las operaciones ya registradas conservan la tarifa con la que se liquidaron.</p>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th><th>{esPrendas ? 'Prenda' : 'Adicional'}</th>
                {!esPrendas && <th>Categoría</th>}
                <th className="num">Tarifa interna</th><th className="num">Tarifa externa</th><th className="num">Diferencia</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={i.activo ? '' : 'inactivo'}>
                  <td className="codigo">{i.codigo}</td>
                  <td>{i.nombre}{i.nota && <small className="sub alerta">{i.nota}</small>}</td>
                  {!esPrendas && <td className="texto-suave">{i.categoria}</td>}
                  <td className="num"><CeldaTarifa valor={i.tarifa_interna} onGuardar={(n) => actualizar(i, { tarifa_interna: n })} /></td>
                  <td className="num"><CeldaTarifa valor={i.tarifa_externa} onGuardar={(n) => actualizar(i, { tarifa_externa: n })} /></td>
                  <td className="num texto-suave">{pesos(i.tarifa_externa - i.tarifa_interna)}</td>
                  <td>
                    <button type="button" className="boton-texto" onClick={() => actualizar(i, { activo: i.activo ? 0 : 1, ...(i.nota === 'Valor pendiente' && !i.activo ? { nota: null } : {}) })}>
                      {i.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
