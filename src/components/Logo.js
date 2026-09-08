/**
 * Brand mark: an ascending graph — four nodes linked by edges, the last one
 * emphasised.
 *
 * It reads as a network (infrastructure, connected accounts) and as a rising
 * trend (growth) at the same time, which is the fintech idea the product is
 * built on. Geometric and monoline so it holds up at 16px and at 512px.
 */
import { h } from '../core/runtime.js';

// Node positions on a 24×24 grid, walking up from bottom-left to top-right.
const NODES = [
  { x: 4.6, y: 17.6, r: 1.85 },
  { x: 10, y: 12.2, r: 1.85 },
  { x: 14.4, y: 15.2, r: 1.85 },
  { x: 19.3, y: 6.6, r: 2.75 },  // the outcome node carries the weight
];

const EDGE_PATH = NODES.map((node, index) => `${index === 0 ? 'M' : 'L'}${node.x} ${node.y}`).join(' ');

/** Bare glyph, used inside badges, nav items and avatars. */
export function LogoMark({ size = 17, strokeWidth = 1.7 }) {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    'aria-hidden': 'true', style: { display: 'block' },
  },
    h('path', {
      d: EDGE_PATH,
      stroke: 'currentColor',
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: '0.85',
    }),
    NODES.map((node, index) =>
      h('circle', {
        key: index,
        cx: node.x, cy: node.y, r: node.r,
        fill: 'currentColor',
      })));
}

/** Glyph inside the accent gradient badge. */
export function Logo({ size = 28, radius = 'var(--radius-sm)' }) {
  return h('span', {
    className: 'logo',
    style: { width: `${size}px`, height: `${size}px`, borderRadius: radius },
  }, h(LogoMark, {
    size: Math.round(size * 0.62),
    // Thinner strokes as the badge grows, so the mark stays refined.
    strokeWidth: size > 40 ? 1.5 : 1.8,
  }));
}
