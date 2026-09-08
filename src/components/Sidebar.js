/**
 * App navigation: brand, routes, recent conversations, theme and account.
 *
 * On desktop it is a static column; on mobile it becomes a fixed drawer with
 * a dismissable backdrop.
 */
import { h } from '../core/runtime.js';
import { APP_NAME, APP_VERSION } from '../config.js';
import { NAV_ITEMS, roleLabel } from '../lib/labels.js';
import { initials } from '../lib/format.js';
import { Logo, LogoMark } from './Logo.js';
import { ConversationList } from './ConversationList.js';

export function Sidebar({
  route, onNavigate, conversations, onOpenConversation, activeConversationId,
  email, onLogout, isDark, onToggleTheme, canInstall, onInstall, online,
  isMobile, isOpen, onClose, onDeleteConversation, onDeleteConversations,
  onNewConversation, isAdmin, role,
}) {
  if (isMobile && !isOpen) return null;

  const go = (id) => { onNavigate(id); if (isMobile) onClose(); };

  const nav = h('nav', { className: `sidebar ${isMobile ? 'sidebar--drawer' : ''}`.trim() },
    h('div', { className: 'sidebar__brand' },
      h(Logo, { size: 28 }),
      h('span', { className: 'sidebar__brand-name' }, APP_NAME)),

    h('ul', { className: 'sidebar__nav' },
      NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) =>
        h('li', { key: item.id },
          h('button', {
            className: `nav-item ${route === item.id ? 'is-active' : ''}`.trim(),
            'aria-current': route === item.id ? 'page' : null,
            onClick: () => go(item.id),
          },
            h('span', { className: 'nav-item__icon', 'aria-hidden': 'true' },
              // The agent entry uses the brand mark instead of a glyph.
              item.icon === 'logo' ? h(LogoMark, { size: 14, strokeWidth: 2.8 }) : item.icon),
            item.label)))),

    h(ConversationList, {
      conversations,
      activeId: activeConversationId,
      onOpen: (id) => { onOpenConversation(id); if (isMobile) onClose(); },
      onDelete: onDeleteConversation,
      onDeleteMany: onDeleteConversations,
      onNewConversation: () => { onNewConversation(); if (isMobile) onClose(); },
    }),

    h('div', { className: 'sidebar__spacer' }),

    !online ? h('p', { className: 'sidebar__offline' }, 'Sin conexión — datos en caché') : null,

    canInstall
      ? h('button', { className: 'nav-item nav-item--muted', onClick: onInstall },
          h('span', { className: 'nav-item__icon', 'aria-hidden': 'true' }, '⤓'),
          'Instalar aplicación')
      : null,

    // La configuración vive abajo, con las acciones de la app, no entre las
    // vistas de datos: se visita poco y no es parte del trabajo diario.
    h('button', {
      className: `nav-item nav-item--muted ${route === 'settings' ? 'is-active' : ''}`.trim(),
      onClick: () => go('settings'),
    },
      h('span', { className: 'nav-item__icon', 'aria-hidden': 'true' }, '⚙'),
      'Configuración'),

    h('div', { className: 'sidebar__account' },
      h('span', { className: 'avatar' }, initials(email)),
      h('span', { className: 'sidebar__account-info' },
        h('span', { className: 'sidebar__email' }, email),
        // El cargo real de la cuenta, no uno escrito a mano.
        h('span', { className: 'sidebar__role' }, roleLabel(role))),
      h('button', {
        className: 'sidebar__logout', onClick: onLogout,
        title: 'Cerrar sesión', 'aria-label': 'Cerrar sesión',
      }, '⎋')),

    // Qué versión está corriendo el navegador: si no coincide con la del
    // servidor, lo que se ve viene de la caché.
    h('p', { className: 'sidebar__version' }, `Mandioca ${APP_VERSION}`));

  if (!isMobile) return nav;

  return h('div', null,
    h('div', { className: 'drawer-backdrop', onClick: onClose }),
    nav);
}
