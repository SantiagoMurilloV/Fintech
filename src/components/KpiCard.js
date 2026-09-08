/**
 * KPI tile. Receives already-formatted strings so the component stays purely
 * presentational (formatting rules live in lib/format.js).
 */
import { h } from '../core/runtime.js';
import { Card } from './Card.js';

export function KpiCard({ label, value, delta, positive, caption }) {
  return h(Card, { className: 'kpi' },
    h('div', { className: 'kpi__label' }, label),
    h('div', { className: 'kpi__value' }, value),
    delta
      ? h('div', { className: `kpi__delta ${positive ? 'is-positive' : 'is-negative'}` },
          delta, caption ? ` ${caption}` : '')
      : null,
  );
}
