import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const DB_PATH = join(dataDir, 'liquidacion.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS trabajadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('INTERNO','EXTERNO')),
  especialidad TEXT DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1,
  livianas INTEGER NOT NULL DEFAULT 1,
  jean INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tarifa_interna REAL NOT NULL DEFAULT 0,
  tarifa_externa REAL NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1
);

-- Adicionales: operaciones que se suman a la prenda (cinta reflectiva, bolsillos, marquilla, charreteras, ojal, botón, operaciones de jean...)
CREATE TABLE IF NOT EXISTS adicionales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Adicional',
  tarifa_interna REAL NOT NULL DEFAULT 0,
  tarifa_externa REAL NOT NULL DEFAULT 0,
  nota TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS operaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajador_id INTEGER NOT NULL REFERENCES trabajadores(id),
  tipo_trabajador TEXT NOT NULL,
  fecha TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fin TEXT NOT NULL,
  minutos INTEGER NOT NULL,
  tipo_doc TEXT NOT NULL CHECK (tipo_doc IN ('OC','ORC')),
  num_orden TEXT NOT NULL,
  orden_compra TEXT,
  cliente TEXT,
  talla TEXT,
  prenda_id INTEGER NOT NULL REFERENCES prendas(id),
  cantidad INTEGER NOT NULL,
  tarifa_prenda REAL NOT NULL,
  valor_prendas REAL NOT NULL,
  valor_adicionales REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  observaciones TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS operacion_adicionales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operacion_id INTEGER NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
  adicional_id INTEGER NOT NULL REFERENCES adicionales(id),
  cantidad_por_prenda REAL NOT NULL,
  prendas INTEGER NOT NULL,
  tarifa REAL NOT NULL,
  valor REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_op_fecha ON operaciones(fecha);
CREATE INDEX IF NOT EXISTS idx_op_trab ON operaciones(trabajador_id);

-- ===== Jeans y chaquetas: se liquida por prenda y operación =====
-- Catálogo de operaciones (hoja OPERACIONES JEAN): cada una con su máquina o herramienta y su valor
CREATE TABLE IF NOT EXISTS jc_operaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  proceso TEXT NOT NULL CHECK (proceso IN ('JEAN','CHAQUETA')),
  area TEXT DEFAULT '',
  maquina TEXT DEFAULT '',
  valor REAL NOT NULL DEFAULT 0,
  tiempo_estandar REAL,            -- segundos por unidad (estudio de tiempos, hoja Registro); NULL si no se ha medido
  nota TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS jc_registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajador_id INTEGER NOT NULL REFERENCES trabajadores(id),
  tipo_trabajador TEXT NOT NULL,
  proceso TEXT NOT NULL CHECK (proceso IN ('JEAN','CHAQUETA')),
  fecha TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fin TEXT NOT NULL,
  minutos INTEGER NOT NULL,
  tipo_doc TEXT NOT NULL CHECK (tipo_doc IN ('OC','ORC')),
  num_orden TEXT NOT NULL,
  orden_compra TEXT,
  cliente TEXT,
  prenda TEXT NOT NULL,
  talla TEXT,
  cantidad INTEGER NOT NULL,
  total REAL NOT NULL,
  costo_minuto REAL,               -- costo del minuto de mano de obra vigente al registrar
  observaciones TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Cada registro lleva una o varias operaciones; valor y tiempo estándar se guardan para que cambiarlos después no altere liquidaciones pasadas
CREATE TABLE IF NOT EXISTS jc_registro_ops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_id INTEGER NOT NULL REFERENCES jc_registros(id) ON DELETE CASCADE,
  operacion_id INTEGER NOT NULL REFERENCES jc_operaciones(id),
  cantidad REAL NOT NULL,
  valor_unitario REAL NOT NULL,
  valor REAL NOT NULL,
  tiempo_estandar REAL
);

CREATE INDEX IF NOT EXISTS idx_jc_fecha ON jc_registros(fecha);
CREATE INDEX IF NOT EXISTS idx_jc_trab ON jc_registros(trabajador_id);

-- Valores generales editables (costo del minuto de mano de obra, hoja salarios)
CREATE TABLE IF NOT EXISTS parametros (
  clave TEXT PRIMARY KEY,
  valor REAL NOT NULL
);
`);

const leerSeed = () => JSON.parse(readFileSync(join(dataDir, 'seed.json'), 'utf8'));
const columnas = (tabla) => db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);

// Sección de cada trabajador según su especialidad: si dice JEAN o CHAQUETA va a Jeans y chaquetas
const asignarSecciones = () => db.exec(`
  UPDATE trabajadores SET
    jean = CASE WHEN UPPER(especialidad) LIKE '%JEAN%' OR UPPER(especialidad) LIKE '%CHAQUETA%' THEN 1 ELSE 0 END,
    livianas = CASE WHEN UPPER(especialidad) LIKE '%JEAN%' OR UPPER(especialidad) LIKE '%CHAQUETA%' THEN 0 ELSE 1 END`);

// Bases creadas antes del módulo de jeans: agregar las columnas de sección sin perder datos
if (!columnas('trabajadores').includes('jean')) {
  db.exec('ALTER TABLE trabajadores ADD COLUMN livianas INTEGER NOT NULL DEFAULT 1');
  db.exec('ALTER TABLE trabajadores ADD COLUMN jean INTEGER NOT NULL DEFAULT 0');
  asignarSecciones();
}

// Carga inicial desde data/seed.json (extraído del Excel CONTROL TALLERES) si la base está vacía
const vacia = db.prepare('SELECT COUNT(*) n FROM prendas').get().n === 0;
if (vacia) {
  const seed = leerSeed();
  const insT = db.prepare('INSERT INTO trabajadores (codigo,nombre,tipo,especialidad,activo) VALUES (@codigo,@nombre,@tipo,@especialidad,@activo)');
  const insP = db.prepare('INSERT INTO prendas (codigo,nombre,tarifa_interna,tarifa_externa) VALUES (@codigo,@nombre,@tarifa_interna,@tarifa_externa)');
  const insA = db.prepare('INSERT INTO adicionales (codigo,nombre,categoria,tarifa_interna,tarifa_externa,nota,activo) VALUES (@codigo,@nombre,@categoria,@tarifa_interna,@tarifa_externa,@nota,@activo)');
  db.transaction(() => {
    seed.trabajadores.forEach((t) => insT.run(t));
    seed.prendas.forEach((p) => insP.run(p));
    seed.adicionales.forEach((a) => insA.run({ nota: null, ...a }));
    asignarSecciones();
  })();
  console.log(`Base inicial cargada: ${seed.trabajadores.length} trabajadores, ${seed.prendas.length} prendas, ${seed.adicionales.length} adicionales`);
}

// Bases creadas antes de la comparativa de eficiencia: agregar tiempo estándar y área (CONSOLIDADO MANO DE OBRA JEAN)
if (!columnas('jc_operaciones').includes('tiempo_estandar')) {
  db.transaction(() => {
    db.exec("ALTER TABLE jc_operaciones ADD COLUMN area TEXT DEFAULT ''");
    db.exec('ALTER TABLE jc_operaciones ADD COLUMN tiempo_estandar REAL');
    db.exec('ALTER TABLE jc_registros ADD COLUMN costo_minuto REAL');
    db.exec('ALTER TABLE jc_registro_ops ADD COLUMN tiempo_estandar REAL');
    const up = db.prepare('UPDATE jc_operaciones SET area=@area, tiempo_estandar=@tiempo_estandar WHERE codigo=@codigo');
    leerSeed().operaciones_jc.forEach((o) => up.run(o));
    db.exec('UPDATE jc_registro_ops SET tiempo_estandar = (SELECT o.tiempo_estandar FROM jc_operaciones o WHERE o.id = operacion_id)');
  })();
}

if (db.prepare('SELECT COUNT(*) n FROM jc_operaciones').get().n === 0) {
  const { operaciones_jc = [] } = leerSeed();
  const ins = db.prepare('INSERT INTO jc_operaciones (codigo,nombre,proceso,area,maquina,valor,tiempo_estandar,nota,activo) VALUES (@codigo,@nombre,@proceso,@area,@maquina,@valor,@tiempo_estandar,@nota,@activo)');
  db.transaction(() => operaciones_jc.forEach((o) => ins.run(o)))();
  console.log(`Operaciones de jeans y chaquetas cargadas: ${operaciones_jc.length}`);
}

if (db.prepare('SELECT COUNT(*) n FROM parametros').get().n === 0) {
  const { parametros = {} } = leerSeed();
  const ins = db.prepare('INSERT INTO parametros (clave,valor) VALUES (?,?)');
  Object.entries(parametros).forEach(([k, v]) => ins.run(k, v));
}
// Registros guardados antes de existir el costo por minuto toman el vigente
db.exec("UPDATE jc_registros SET costo_minuto = (SELECT valor FROM parametros WHERE clave='costo_minuto') WHERE costo_minuto IS NULL");

export default db;
