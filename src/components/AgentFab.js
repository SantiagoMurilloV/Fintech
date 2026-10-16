/**
 * Floating action button that jumps to the agent from any data view.
 *
 * Hidden on the agent view itself, where the composer is already on screen.
 */
import { h } from '../core/runtime.js';
import { LogoMark } from './Logo.js';

export function AgentFab({ onClick }) {
  return h('button', {
    className: 'agent-fab',
    onClick,
    title: 'Abrir el chat',
    'aria-label': 'Abrir el chat',
  },
    h(LogoMark, { size: 20, strokeWidth: 2.6 }),
    h('span', { className: 'agent-fab__label' }, 'Abrir chat'));
}
