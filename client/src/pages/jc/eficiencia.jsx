import { duracion } from '../../api.js';

// Igual que la tabla dinámica del CONSOLIDADO MANO DE OBRA JEAN: si el real no supera al estimado hubo EFICIENCIA, si lo supera, SOBRECOSTO
export function resumir(regs) {
  const comparables = regs.filter((r) => r.comparable);
  const r = {
    registros: regs.length,
    comparables: comparables.length,
    sinTiempo: regs.length - comparables.length,
    prendas: regs.reduce((s, x) => s + x.cantidad, 0),
    pagado: regs.reduce((s, x) => s + x.total, 0),
    minEstimados: comparables.reduce((s, x) => s + x.minutos_estimados, 0),
    minReales: comparables.reduce((s, x) => s + x.minutos, 0),
    costoEstimado: comparables.reduce((s, x) => s + x.costo_estimado, 0),
    costoReal: comparables.reduce((s, x) => s + x.costo_real, 0),
  };
  r.difMinutos = r.minReales - r.minEstimados;
  r.difCosto = r.costoReal - r.costoEstimado;
  r.eficiencia = r.minReales ? (r.minEstimados / r.minReales) * 100 : null;
  return r;
}

export function agruparPor(regs, clave, etiqueta) {
  const m = new Map();
  for (const r of regs) {
    const k = clave(r);
    if (!m.has(k)) m.set(k, { clave: k, etiqueta: etiqueta(r), regs: [] });
    m.get(k).regs.push(r);
  }
  return [...m.values()].map((g) => ({ ...g, ...resumir(g.regs) }));
}

export const minutosTexto = (m) => (m > 0 && m < 1 ? `${Math.round(m * 60)} s` : duracion(Math.round(m)));

export function Etiqueta({ diferencia, comparable = true }) {
  if (!comparable) return <span className="etiqueta-eficiencia sin-dato" title="Alguna operación no tiene tiempo estándar">Sin tiempo estándar</span>;
  return diferencia <= 0
    ? <span className="etiqueta-eficiencia ok">Eficiencia</span>
    : <span className="etiqueta-eficiencia sobre">Sobrecosto</span>;
}
