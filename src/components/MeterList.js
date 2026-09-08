/** List of labeled progress meters (gateway share, expense categories). */
import { h } from '../core/runtime.js';

export function MeterList({ items, subtle = false }) {
  return h('div', { className: 'meters' },
    items.map((item) =>
      h('div', { key: item.label, className: 'meters__item' },
        h('div', { className: 'meters__head' },
          h('span', null, item.label),
          h('span', { className: 'meters__value' }, item.display)),
        h('div', { className: 'meter' },
          h('div', {
            className: `meter__fill ${subtle ? 'is-subtle' : ''}`.trim(),
            style: { width: item.width },
          })))));
}

/** Compact metric grid used for expense categories. */
export function MetricGrid({ items }) {
  return h('div', { className: 'metric-grid' },
    items.map((item) =>
      h('div', { key: item.label, className: 'metric' },
        h('span', { className: 'metric__label' }, item.label),
        h('span', { className: 'metric__value' }, item.display),
        h('div', { className: 'meter' },
          h('div', { className: 'meter__fill is-subtle', style: { width: item.width } })))));
}
