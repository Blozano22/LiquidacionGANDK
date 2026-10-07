import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Selector con búsqueda por texto.
 * opciones: [{ id, etiqueta, detalle?, grupo?, busqueda? }] — busqueda: texto en el que se busca (por defecto etiqueta + detalle)
 */
export default function Buscador({ opciones, valor, onChange, placeholder = 'Escribe para buscar…', id, autoFocus }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef(null);
  const lista = useRef(null);

  const seleccionada = opciones.find((o) => o.id === valor);

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => (o.busqueda ?? `${o.etiqueta} ${o.detalle || ''}`).toLowerCase().includes(q));
  }, [texto, opciones]);

  useEffect(() => setActivo(0), [texto]);

  useEffect(() => {
    const el = lista.current?.querySelector('[data-activo="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  const elegir = (o) => {
    onChange(o.id);
    setTexto('');
    setAbierto(false);
  };

  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(a + 1, filtradas.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && abierto && filtradas[activo]) { e.preventDefault(); elegir(filtradas[activo]); }
    else if (e.key === 'Escape') setAbierto(false);
  };

  let grupoPrevio = null;

  return (
    <div className="buscador" ref={caja} onBlur={(e) => !caja.current.contains(e.relatedTarget) && setAbierto(false)}>
      <input
        id={id}
        autoFocus={autoFocus}
        autoComplete="off"
        value={abierto ? texto : seleccionada ? seleccionada.etiqueta : ''}
        placeholder={seleccionada ? seleccionada.etiqueta : placeholder}
        onFocus={() => setAbierto(true)}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onKeyDown={teclas}
        role="combobox"
        aria-expanded={abierto}
      />
      {abierto && (
        <ul className="buscador-lista" ref={lista} role="listbox">
          {filtradas.length === 0 && <li className="buscador-vacio">Sin coincidencias para “{texto}”.</li>}
          {filtradas.map((o, i) => {
            const cabecera = o.grupo && o.grupo !== grupoPrevio ? o.grupo : null;
            grupoPrevio = o.grupo;
            return (
              <li key={o.id} role="presentation">
                {cabecera && <div className="buscador-grupo">{cabecera}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === valor}
                  data-activo={i === activo}
                  className={`buscador-opcion${i === activo ? ' activo' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(o)}
                >
                  <span>{o.etiqueta}</span>
                  {o.detalle && <small>{o.detalle}</small>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
