import { hoyISO } from './api.js';

const iso = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

export const RANGOS = {
  hoy: () => [hoyISO(), hoyISO()],
  semana: () => {
    const d = new Date();
    const lunes = new Date(d);
    lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return [iso(lunes), hoyISO()];
  },
  quincena: () => {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth();
    return d.getDate() <= 15 ? [iso(new Date(y, m, 1)), iso(new Date(y, m, 15))] : [iso(new Date(y, m, 16)), iso(new Date(y, m + 1, 0))];
  },
  mes: () => {
    const d = new Date();
    return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  },
  mesAnterior: () => {
    const d = new Date();
    return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))];
  },
};

export const ATAJOS = [
  ['hoy', 'Hoy'],
  ['semana', 'Esta semana'],
  ['quincena', 'Quincena actual'],
  ['mes', 'Este mes'],
  ['mesAnterior', 'Mes anterior'],
];

// CSV con separador ; y BOM para que Excel en español lo abra con tildes y columnas correctas
export function descargarCSV(nombre, cabecera, filas) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [cabecera, ...filas].map((f) => f.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
