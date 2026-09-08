/** Findings list — used for anomaly alerts and import errors. */
import { h } from '../../core/runtime.js';

export function ListBlock({ items, title }) {
  return h('div', { className: 'block block-list' },
    title ? h('h4', { className: 'block-list__title' }, title) : null,
    h('ul', null,
      items.map((item, index) =>
        h('li', { key: index, className: `block-list__item tone-${item.tone || 'info'}` },
          h('span', { className: 'block-list__dot', 'aria-hidden': 'true' }),
          h('span', null,
            h('strong', null, item.title),
            item.detail ? h('span', { className: 'block-list__detail' }, item.detail) : null)))));
}
