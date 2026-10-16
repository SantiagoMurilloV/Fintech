/**
 * KPI tiles inside a chat message or the analysis.
 *
 * A tile may carry `tone` (success · warning · danger · neutral), which tints
 * its keyline and delta: an approved total reads green, a rejected one red.
 * Older blocks only say `positive`, which maps to success or danger.
 */
import { h } from '../../core/runtime.js';

const toneOf = (item) => item.tone || (item.positive ? 'success' : 'danger');

export function KpiBlock({ items }) {
  return h('div', { className: 'block block-kpis' },
    items.map((item) =>
      h('div', { key: item.label, className: `block-kpi tone-${toneOf(item)}` },
        h('span', { className: 'block-kpi__label' }, item.label),
        h('span', { className: 'block-kpi__value' }, item.value),
        item.delta
          ? h('span', {
              className: `block-kpi__delta is-${toneOf(item)}`,
            }, `${item.delta}${item.caption ? ` ${item.caption}` : ''}`)
          : null)));
}
