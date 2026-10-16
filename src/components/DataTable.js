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
import * as fmt from '../lib/format.js';

/**
 * Header cell. A column with `sort` (a key the API understands without its
 * `_asc`/`_desc` suffix) becomes a button: first click sorts by it in its
 * natural direction (`sortFirst`, «desc» unless said otherwise), the next
 * click flips it.
 */
function HeaderCell({ column, sort, onSort }) {
  const className = column.align === 'right' ? 'is-right' : '';
  if (!column.sort || !onSort) return h('div', { className }, column.header);
  const [field, direction] = (sort || '').split(/_(?=asc$|desc$)/);
  const on = field === column.sort;
  const next = on
    ? `${column.sort}_${direction === 'asc' ? 'desc' : 'asc'}`
    : `${column.sort}_${column.sortFirst || 'desc'}`;
  return h('div', {
    className,
    'aria-sort': on ? (direction === 'asc' ? 'ascending' : 'descending') : 'none',
  },
    h('button', {
      type: 'button',
      className: `th-sort ${on ? 'is-on' : ''}`.trim(),
      onClick: () => onSort(next),
      title: 'Ordenar por esta columna',
    },
      column.header,
      h('span', { className: 'th-sort__arrow', 'aria-hidden': 'true' },
        on ? (direction === 'asc' ? '↑' : '↓') : '↕')));
}

export function DataTable({
  columns, rows, rowKey, empty = 'Sin resultados.', loading, footer,
  // Current sort key (e.g. "amount_desc") and its setter; both optional.
  sort, onSort,
  // Keeps columns legible on phones: below this width the card scrolls sideways.
  minWidth = '620px',
}) {
  const template = columns.map((c) => c.width || '1fr').join(' ');
  const gridStyle = { gridTemplateColumns: template, minWidth };

  return h(Card, { className: 'table' },
    h('div', { className: 'table__head', style: gridStyle },
      columns.map((column) => h(HeaderCell, { key: column.key, column, sort, onSort }))),

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

/**
 * Footer with a result summary and page controls.
 *
 * With only `canPrev`/`canNext` it is the classic «← Anterior · Siguiente →».
 * Given `page`, `pages` and `onPage` it adds first/last, «Página X de Y» with
 * a box to jump straight to a page; given `pageSize` and `onPageSize`, a
 * rows-per-page picker. A thousand rows are then four clicks away, not forty.
 */
export function TablePager({
  summary, canPrev, canNext, onPrev, onNext,
  page, pages, onPage, pageSize, pageSizes = [25, 50, 100, 200], onPageSize,
}) {
  const paged = onPage && pages > 0;
  const jump = (event) => {
    const wanted = Math.round(Number(event.target.value));
    if (!Number.isFinite(wanted) || wanted < 1) { event.target.value = String(page); return; }
    const target = Math.min(wanted, pages);
    event.target.value = String(target);
    if (target !== page) onPage(target);
  };
  return h('div', { className: 'pager' },
    h('span', { className: 'pager__summary' }, summary),
    h('div', { className: 'pager__controls' },
      onPageSize ? h('label', { className: 'pager__size' },
        h('span', null, 'Filas'),
        h('select', {
          className: 'pager__select',
          value: String(pageSize),
          onChange: (event) => onPageSize(Number(event.target.value)),
          'aria-label': 'Filas por página',
        }, pageSizes.map((size) => h('option', { key: size, value: String(size) }, String(size)))))
        : null,
      paged ? h('button', {
        className: 'pager__link', disabled: page <= 1, onClick: () => onPage(1),
        'aria-label': 'Primera página', title: 'Primera página',
      }, '«') : null,
      h('button', {
        className: 'pager__link', disabled: !canPrev, onClick: onPrev,
      }, '← Anterior'),
      paged ? h('span', { className: 'pager__page' },
        'Página ',
        h('input', {
          className: 'pager__jump', type: 'number', min: '1', max: String(pages),
          value: String(page), 'aria-label': 'Ir a la página',
          onChange: jump,
          onKeyDown: (event) => { if (event.key === 'Enter') jump(event); },
        }),
        ` de ${fmt.integer(pages)}`) : null,
      h('button', {
        className: 'pager__link', disabled: !canNext, onClick: onNext,
      }, 'Siguiente →'),
      paged ? h('button', {
        className: 'pager__link', disabled: page >= pages, onClick: () => onPage(pages),
        'aria-label': 'Última página', title: 'Última página',
      }, '»') : null),
  );
}
