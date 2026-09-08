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
    title: 'Hablar con el agente',
    'aria-label': 'Hablar con el agente',
  },
    h(LogoMark, { size: 20, strokeWidth: 2.6 }),
    h('span', { className: 'agent-fab__label' }, 'Preguntar al agente'));
}
