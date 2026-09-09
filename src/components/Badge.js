/** Pill badge. Tones: success | warning | danger | neutral. */
import { h } from '../core/runtime.js';

export function Badge({ tone = 'neutral', title, children }) {
  return h('span', { className: `badge badge--${tone}`, title }, children);
}
