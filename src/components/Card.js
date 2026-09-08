/** Glass surface used by panels, tables and KPI tiles. */
import { h } from '../core/runtime.js';

export function Card({ className = '', children, ...rest }) {
  return h('div', { className: `card ${className}`.trim(), ...rest }, children);
}

/** Card with a title row, for chart and list panels. */
export function Panel({ title, className = '', children }) {
  return h(Card, { className: `panel ${className}`.trim() },
    title ? h('h2', { className: 'panel__title' }, title) : null,
    children);
}
