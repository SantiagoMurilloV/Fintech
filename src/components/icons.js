/**
 * Inline SVG icons. Stroke follows `currentColor`, so each icon takes the
 * color of the text around it; size comes from the `size` prop (default 14).
 */
import { h } from '../core/runtime.js';

const base = (size) => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
  'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  'aria-hidden': 'true',
});

/** Pencil: edit in place. */
export function PencilIcon({ size = 14 } = {}) {
  return h('svg', base(size),
    h('path', { d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' }));
}

/** Pencil with sparks: the field is written for you (generated). */
export function MagicPencilIcon({ size = 15 } = {}) {
  return h('svg', base(size),
    // The same pencil, shrunk toward the bottom-right so the sparks fit.
    h('g', { transform: 'translate(5 3) scale(0.8)' },
      h('path', { d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' })),
    // Four-point sparks, filled so they read at small sizes.
    h('path', {
      d: 'M5 2l.7 1.6 1.6.7-1.6.7L5 6.6l-.7-1.6-1.6-.7 1.6-.7L5 2z',
      fill: 'currentColor', stroke: 'none',
    }),
    h('path', {
      d: 'M3.5 9l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5.5-1.1z',
      fill: 'currentColor', stroke: 'none',
    }));
}
