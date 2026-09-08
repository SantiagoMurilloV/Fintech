/** Mobile header: menu toggle, brand and theme switch. */
import { h } from '../core/runtime.js';
import { APP_NAME } from '../config.js';
import { Logo } from './Logo.js';

export function MobileTopBar({ onToggleMenu, onToggleTheme, isDark }) {
  return h('header', { className: 'topbar' },
    h('button', {
      className: 'topbar__menu',
      onClick: onToggleMenu,
      'aria-label': 'Menú',
    }, '☰'),
    h(Logo, { size: 26 }),
    h('span', { className: 'topbar__brand' }, APP_NAME),
    h('button', {
      className: 'topbar__theme',
      onClick: onToggleTheme,
      'aria-label': isDark ? 'Tema claro' : 'Tema oscuro',
    }, isDark ? '☀' : '☾'));
}
