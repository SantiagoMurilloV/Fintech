/**
 * The proof that an import landed as it was: the file's control totals next
 * to what the panel holds now, month by month, with ✓ / ✗ per figure.
 *
 * Shared by the import dialog (right after confirming) and the import
 * history. The backend computes every figure; this only paints them.
 */
import { h } from '../core/runtime.js';
import * as fmt from '../lib/format.js';

const METRIC_LABELS = {
  rows: 'Filas', volume: 'Volumen (USD)', spread: 'Spread', cost: 'Costo proveedor', profit: 'Utilidad',
};

const money = (value) => fmt.amount(value, 'USD');
const show = (metric, value) => (metric === 'rows' ? fmt.integer(value) : money(value));

/** One line: «Cuadra» / «No cuadra» with the reasons. */
export function ReconciliationVerdict({ reconciliation }) {
  if (!reconciliation || reconciliation.ok === null || reconciliation.ok === undefined) return null;
  const { ok, rows_file: file, rows_panel: panel, missing, changed = [] } = reconciliation;
  const reasons = [];
  if (missing) reasons.push(`${fmt.integer(missing)} filas del archivo ya no están en el panel`);
  if (changed.length) reasons.push(`${fmt.integer(changed.length)} filas se editaron después de importar`);
  return h('div', { className: `verdict ${ok ? 'verdict--ok' : 'verdict--bad'}` },
    h('strong', null, ok ? '✓ Cuadra' : '✗ No cuadra'),
    h('span', null, ok
      ? `Las ${fmt.integer(file)} filas del archivo están en el panel con los mismos totales, mes por mes.`
      : `${fmt.integer(panel)} de ${fmt.integer(file)} filas en el panel. ${reasons.join(' · ') || 'Algún total mensual no coincide.'}`));
}

/** File | Panel | ✓/✗ for each metric, one row per month. */
export function ReconciliationTable({ reconciliation }) {
  const months = reconciliation?.months || [];
  const metrics = reconciliation?.metrics || [];
  if (!months.length) return null;
  return h('div', { className: 'recon' },
    h('div', { className: 'recon__scroll' },
      h('table', { className: 'recon__table' },
        h('thead', null,
          h('tr', null,
            h('th', { rowSpan: 2 }, 'Mes'),
            metrics.map((m) => h('th', { key: m, colSpan: 3, className: 'recon__group' }, METRIC_LABELS[m] || m))),
          h('tr', null,
            metrics.map((m) => [
              h('th', { key: `${m}f`, className: 'is-num' }, 'Archivo'),
              h('th', { key: `${m}p`, className: 'is-num' }, 'Panel'),
              h('th', { key: `${m}o` }, ''),
            ]))),
        h('tbody', null,
          months.map((month) => h('tr', { key: month.month },
            h('td', null, fmt.periodName(month.month)),
            metrics.map((m) => {
              const cell = month[m] || {};
              return [
                h('td', { key: `${m}f`, className: 'is-num' }, show(m, cell.file)),
                h('td', { key: `${m}p`, className: `is-num ${cell.ok ? '' : 'is-bad'}`.trim() }, show(m, cell.panel)),
                h('td', { key: `${m}o`, className: cell.ok ? 'recon__ok' : 'recon__bad' }, cell.ok ? '✓' : '✗'),
              ];
            })))))));
}
