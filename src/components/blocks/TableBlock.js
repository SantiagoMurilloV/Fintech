/**
 * Table block.
 *
 * A cell can be a plain value, a badge ({label, tone}) or a link
 * ({label, url}); the column declares alignment and kind.
 */
import { h } from '../../core/runtime.js';

function Cell({ value, column }) {
  if (value == null || value === '') return h('span', { className: 'muted' }, '—');

  if (typeof value === 'object') {
    if (value.url) {
      return h('a', { className: 'link', href: value.url, target: '_blank', rel: 'noopener' },
        value.label || 'Abrir');
    }
    return h('span', { className: `badge badge--${value.tone || 'neutral'}` },
      value.label ?? String(value));
  }

  if (column.kind === 'badge') {
    return h('span', { className: 'badge badge--neutral' }, String(value));
  }
  return String(value);
}

export function TableBlock({ columns, rows, caption, wide }) {
  const template = columns
    .map((column) => (column.align === 'right' ? 'minmax(90px, auto)' : 'minmax(110px, 1fr)'))
    .join(' ');

  return h('div', { className: `block block-table ${wide ? 'block-table--wide' : ''}`.trim() },
    h('div', { className: 'block-table__scroll' },
      h('div', { className: 'block-table__grid', style: { gridTemplateColumns: template } },
        columns.map((column) =>
          h('div', {
            key: column.key,
            className: `block-table__head ${column.align === 'right' ? 'is-right' : ''}`.trim(),
          }, column.label)),
        rows.map((row, rowIndex) =>
          columns.map((column) =>
            h('div', {
              key: `${rowIndex}-${column.key}`,
              className: `block-table__cell ${column.align === 'right' ? 'is-right' : ''}`.trim(),
            }, h(Cell, { value: row[column.key], column })))))),
    caption ? h('p', { className: 'block-table__caption' }, caption) : null);
}
