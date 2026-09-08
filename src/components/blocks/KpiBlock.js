/** KPI tiles inside a chat message. */
import { h } from '../../core/runtime.js';

export function KpiBlock({ items }) {
  return h('div', { className: 'block block-kpis' },
    items.map((item) =>
      h('div', { key: item.label, className: 'block-kpi' },
        h('span', { className: 'block-kpi__label' }, item.label),
        h('span', { className: 'block-kpi__value' }, item.value),
        item.delta
          ? h('span', {
              className: `block-kpi__delta ${item.positive ? 'is-positive' : 'is-negative'}`,
            }, `${item.delta}${item.caption ? ` ${item.caption}` : ''}`)
          : null)));
}
