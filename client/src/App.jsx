import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Registro from './pages/Registro.jsx';
import Liquidacion from './pages/Liquidacion.jsx';
import Trabajadores from './pages/Trabajadores.jsx';
import Tarifas from './pages/Tarifas.jsx';
import RegistroJC from './pages/jc/RegistroJC.jsx';
import LiquidacionJC from './pages/jc/LiquidacionJC.jsx';
import OperacionesJC from './pages/jc/OperacionesJC.jsx';
import EficienciaJC from './pages/jc/EficienciaJC.jsx';

// Cada módulo liquida distinto: livianas por prenda + adicionales; jeans y chaquetas por prenda y operación
const MODULOS = {
  livianas: {
    nombre: 'Prendas livianas',
    detalle: 'Camisas, blusas, polos, filipinas…',
    secciones: [
      { id: 'registro', nombre: 'Registrar operación' },
      { id: 'liquidacion', nombre: 'Liquidación' },
      { id: 'trabajadores', nombre: 'Trabajadores' },
      { id: 'tarifas', nombre: 'Tarifas' },
    ],
  },
  jc: {
    nombre: 'Jeans y chaquetas',
    detalle: 'Se liquida por prenda y operación',
    secciones: [
      { id: 'registro', nombre: 'Registrar trabajo' },
      { id: 'liquidacion', nombre: 'Liquidación' },
      { id: 'eficiencia', nombre: 'Eficiencia y costos' },
      { id: 'trabajadores', nombre: 'Trabajadores' },
      { id: 'operaciones', nombre: 'Operaciones y valores' },
    ],
  },
};

const leerModulo = () => {
  try {
    const m = localStorage.getItem('modulo');
    return MODULOS[m] ? m : 'livianas';
  } catch {
    return 'livianas';
  }
};

export default function App() {
  const [modulo, setModulo] = useState(leerModulo);
  const [seccion, setSeccion] = useState('registro');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [catalogos, setCatalogos] = useState({ trabajadores: [], prendas: [], adicionales: [], jcOperaciones: [], parametros: {} });
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try {
      const [trabajadores, prendas, adicionales, jcOperaciones, parametros] = await Promise.all([
        api.get('/trabajadores'),
        api.get('/prendas'),
        api.get('/adicionales'),
        api.get('/jc/operaciones'),
        api.get('/parametros'),
      ]);
      setCatalogos({ trabajadores, prendas, adicionales, jcOperaciones, parametros });
      setError('');
    } catch {
      setError('No hay conexión con el servidor. Revisa que la API esté corriendo en el puerto 3001 (npm run dev).');
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e) => e.key === 'Escape' && setMenuAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [menuAbierto]);

  const elegirModulo = (m) => {
    setModulo(m);
    setSeccion('registro');
    setMenuAbierto(false);
    try { localStorage.setItem('modulo', m); } catch { /* sin almacenamiento: se vuelve a livianas al recargar */ }
  };

  const mod = MODULOS[modulo];

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          <button type="button" className="hamburguesa" aria-label="Abrir menú" aria-expanded={menuAbierto} aria-controls="menu-lateral" onClick={() => setMenuAbierto(true)}>
            <span /><span /><span />
          </button>
          <span className="marca-logo"><img src="/logo.png" alt="GANDK Dotaciones" /></span>
          <div>
            <strong>{mod.nombre}</strong>
            <span>Liquidación de producción · GANDK Dotaciones</span>
          </div>
        </div>
        <nav className="pestanas" aria-label="Secciones">
          {mod.secciones.map((s) => (
            <button
              key={s.id}
              className={seccion === s.id ? 'pestana activa' : 'pestana'}
              aria-current={seccion === s.id ? 'page' : undefined}
              onClick={() => setSeccion(s.id)}
            >
              {s.nombre}
            </button>
          ))}
        </nav>
      </header>

      {menuAbierto && <div className="menu-fondo" onClick={() => setMenuAbierto(false)} aria-hidden="true" />}
      <aside id="menu-lateral" className={menuAbierto ? 'menu-lateral abierto' : 'menu-lateral'} aria-hidden={!menuAbierto} inert={menuAbierto ? undefined : ''}>
        <div className="menu-cabecera">
          <strong>GANDK Dotaciones</strong>
          <button type="button" className="menu-cerrar" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)}>×</button>
        </div>
        <p className="menu-titulo">Liquidación</p>
        <nav aria-label="Módulos">
          {Object.entries(MODULOS).map(([k, m]) => (
            <button key={k} type="button" className={modulo === k ? 'menu-opcion activa' : 'menu-opcion'} aria-current={modulo === k ? 'page' : undefined} onClick={() => elegirModulo(k)}>
              <strong>{m.nombre}</strong>
              <small>{m.detalle}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="contenido">
        {error && <div className="aviso aviso-error">{error}</div>}
        {modulo === 'livianas' && (
          <>
            {seccion === 'registro' && <Registro catalogos={catalogos} irA={setSeccion} />}
            {seccion === 'liquidacion' && <Liquidacion catalogos={catalogos} />}
            {seccion === 'trabajadores' && <Trabajadores trabajadores={catalogos.trabajadores} recargar={recargar} seccion="livianas" />}
            {seccion === 'tarifas' && <Tarifas prendas={catalogos.prendas} adicionales={catalogos.adicionales} recargar={recargar} />}
          </>
        )}
        {modulo === 'jc' && (
          <>
            {seccion === 'registro' && <RegistroJC catalogos={catalogos} irA={setSeccion} />}
            {seccion === 'liquidacion' && <LiquidacionJC catalogos={catalogos} />}
            {seccion === 'eficiencia' && <EficienciaJC catalogos={catalogos} recargar={recargar} irA={setSeccion} />}
            {seccion === 'trabajadores' && <Trabajadores trabajadores={catalogos.trabajadores} recargar={recargar} seccion="jean" />}
            {seccion === 'operaciones' && <OperacionesJC operaciones={catalogos.jcOperaciones} recargar={recargar} />}
          </>
        )}
      </main>
    </div>
  );
}
