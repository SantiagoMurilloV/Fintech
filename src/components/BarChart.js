/**
 * Vertical bar chart. Bar heights are computed here from raw values — the API
 * never sends presentation numbers.
 */
import { h } from '../core/runtime.js';
import { percentWidth } from '../lib/format.js';

export function BarChart({ bars, dimLast = false }) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return h('div', { className: 'bars' },
    bars.map((bar, index) =>
      h('div', { key: bar.label, className: 'bars__col' },
        h('span', { className: 'bars__value' }, bar.display),
        h('div', {
          className: `bars__bar ${dimLast && index === bars.length - 1 ? 'is-dim' : ''}`.trim(),
          style: { height: percentWidth(bar.value, max) },
        }),
        h('span', { className: 'bars__label' }, bar.label))));
}
