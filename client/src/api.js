async function pedir(url, opciones = {}) {
  const res = await fetch('/api' + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || 'No se pudo completar la acción.');
  return datos;
}

export const api = {
  get: (url) => pedir(url),
  post: (url, body) => pedir(url, { method: 'POST', body }),
  put: (url, body) => pedir(url, { method: 'PUT', body }),
  del: (url) => pedir(url, { method: 'DELETE' }),
};

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const pesos = (n) => fmt.format(Math.round(n || 0));
export const num = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n || 0);

export const duracion = (min) => {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${m ? m + ' min' : ''}`.trim() : `${m} min`;
};

export const minutosEntre = (ini, fin) => {
  if (!ini || !fin) return 0;
  const [h1, m1] = ini.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
};

export const hoyISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const fechaLarga = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
