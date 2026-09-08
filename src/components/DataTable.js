/**
 * Generic data table.
 *
 * `columns` describe layout and how to render each cell:
 *   { key, header, width, align, render(row) }
 * The grid template is derived from the column widths, so every view shares
 * the same table behaviour (header, hover rows, empty state, footer).
 */
import { h } from '../core/runtime.js';
import { Card } from './Card.js';

export function DataTable({
  columns, rows, rowKey, empty = 'Sin resultados.', loading, footer,
  // Keeps columns legible on phones: below this width the card scrolls sideways.
  minWidth = '620px',
}) {
  const template = columns.map((c) => c.width || '1fr').join(' ');
  const gridStyle = { gridTemplateColumns: template, minWidth };

  return h(Card, { className: 'table' },
    h('div', { className: 'table__head', style: gridStyle },
      columns.map((column) =>
        h('div', { key: column.key, className: column.align === 'right' ? 'is-right' : '' },
          column.header))),

    // Rows already on screen stay while a refetch runs: a saved cell must not
    // make the whole table blink back to "Cargando…".
    loading && rows.length === 0
      ? h('div', { className: 'table__state' }, 'Cargando…')
      : rows.length === 0
        ? h('div', { className: 'table__state' }, empty)
        : rows.map((row) =>
            h('div', { key: rowKey(row), className: 'table__row', style: gridStyle },
              columns.map((column) =>
                h('div', {
                  key: column.key,
                  className: [column.align === 'right' ? 'is-right' : '',
                              column.actions ? 'is-actions' : ''].filter(Boolean).join(' '),
                }, column.render(row))))),

    footer ? h('div', { className: 'table__foot' }, footer) : null,
  );
}

/** Footer with a result summary and prev/next controls. */
export function TablePager({ summary, canPrev, canNext, onPrev, onNext }) {
  return h('div', { className: 'pager' },
    h('span', null, summary),
    h('div', { className: 'pager__controls' },
      h('button', {
        className: 'pager__link', disabled: !canPrev, onClick: onPrev,
      }, '← Anterior'),
      h('button', {
        className: 'pager__link', disabled: !canNext, onClick: onNext,
      }, 'Siguiente →')),
  );
}
