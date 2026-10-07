import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
for (const f of ['liquidacion.db', 'liquidacion.db-wal', 'liquidacion.db-shm']) rmSync(join(dir, f), { force: true });
console.log('Base de datos borrada. Se recargará desde seed.json al iniciar el servidor.');
