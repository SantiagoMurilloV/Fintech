/**
 * Chart block.
 *
 * The backend renders the chart to SVG deterministically; we inject that
 * markup (safe: built server-side from numeric series). The title sits ON TOP
 * and reads like one — a chart nobody can name is a chart nobody can read.
 */
import { h } from '../../core/runtime.js';

export function ChartBlock({ svg, title }) {
  return h('figure', { className: 'block block-chart' },
    title ? h('h3', { className: 'block-chart__title' }, title) : null,
    h('div', { className: 'block-chart__canvas', dangerouslySetInnerHTML: svg }));
}
