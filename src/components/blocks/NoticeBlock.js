/** Inline status message: confirmation, warning or error. */
import { h } from '../../core/runtime.js';

const ICONS = { success: '✓', warning: '!', danger: '✕', info: 'i' };

export function NoticeBlock({ content, tone = 'info' }) {
  return h('div', { className: `block block-notice tone-${tone}`, role: 'status' },
    h('span', { className: 'block-notice__icon', 'aria-hidden': 'true' }, ICONS[tone] || 'i'),
    h('span', null, content));
}
