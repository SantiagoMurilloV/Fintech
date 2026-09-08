/** Page title, subtitle and action buttons — shared by every data view. */
import { h } from '../core/runtime.js';

export function PageHeader({ title, subtitle, actions }) {
  return h('header', { className: 'page-head' },
    h('div', null,
      h('h1', { className: 'page-head__title' }, title),
      subtitle ? h('p', { className: 'page-head__subtitle' }, subtitle) : null),
    actions ? h('div', { className: 'page-head__actions' }, actions) : null);
}
