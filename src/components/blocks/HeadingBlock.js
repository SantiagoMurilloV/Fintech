/** Section header inside a long analysis: a titled divider, not a card. */
import { h } from '../../core/runtime.js';

export function HeadingBlock({ content, detail }) {
  return h('div', { className: 'block block-heading' },
    h('h2', { className: 'block-heading__title' }, content),
    detail ? h('p', { className: 'block-heading__detail' }, detail) : null);
}
