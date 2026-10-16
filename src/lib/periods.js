/**
 * Named periods for date filters: «Este mes», «Últimos 30 días»…
 *
 * Dates are computed on the viewer's calendar (local time), never in UTC: at
 * 8 p.m. in Bogotá `toISOString()` is already tomorrow, and «Hoy» would point
 * at a day that has not started. Weeks start on Monday, as in Colombia.
 */

/** Local date -> "YYYY-MM-DD". */
export function isoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The presets offered, in the order they are shown. `range` is typed by hand. */
export const PERIOD_PRESETS = [
  { key: 'all', label: 'Todo' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'last_month', label: 'Mes anterior' },
  { key: 'last_30', label: 'Últimos 30 días' },
  { key: 'year', label: 'Este año' },
  { key: 'range', label: 'Rango de fechas' },
];

/**
 * The dates a preset covers on `today`: { from, to } as ISO strings, empty
 * for «Todo». `range` is not computed here; its dates are the person's.
 */
export function presetRange(key, today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const end = isoDate(today);
  switch (key) {
    case 'week': {
      const sinceMonday = (today.getDay() + 6) % 7;
      return { from: isoDate(new Date(y, m, d - sinceMonday)), to: end };
    }
    case 'month':
      return { from: isoDate(new Date(y, m, 1)), to: end };
    case 'last_month':
      return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) };
    case 'last_30':
      return { from: isoDate(new Date(y, m, d - 29)), to: end };
    case 'year':
      return { from: isoDate(new Date(y, 0, 1)), to: end };
    default:
      return { from: '', to: '' };
  }
}

/** Why a typed range cannot be applied, or null when it can. */
export function rangeProblem(from, to) {
  if (!from || !to) return 'Elija las dos fechas.';
  if (from > to) return 'La fecha «Desde» debe ser anterior a «Hasta».';
  return null;
}
