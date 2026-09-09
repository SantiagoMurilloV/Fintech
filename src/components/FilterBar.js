/**
 * Search box plus the filters the backend derived from the data.
 *
 * The backend decides which columns are worth filtering and which values
 * exist (with counts); this component only paints one select per facet, a
 * search input, a date range and a way to clear everything.
 */
import { h } from '../core/runtime.js';

export function FilterBar({
  search, onSearch,
  facets = [], values = {}, onFacet, labelFor,
  dateFrom = '', dateTo = '', onDates,
  onClear,
}) {
  const anyActive = Boolean(search) || dateFrom || dateTo
    || Object.values(values).some((value) => value);

  return h('div', { className: 'filterbar' },
    h('label', { className: 'filterbar__search' },
      h('span', { className: 'sr-only' }, 'Buscar'),
      h('input', {
        className: 'input',
        type: 'search',
        placeholder: 'Buscar en cualquier campo…',
        value: search,
        onInput: (event) => onSearch(event.target.value),
        'aria-label': 'Buscar en cualquier campo',
      })),

    facets.map((facet) => {
      const current = values[facet.key] || '';
      return h('label', { key: facet.key, className: 'facet' },
        h('span', { className: 'facet__label' }, labelFor(facet)),
        h('select', {
          className: `input facet__select ${current ? 'is-active' : ''}`.trim(),
          value: current,
          onChange: (event) => onFacet(facet.key, event.target.value),
        },
          h('option', { value: '', selected: current === '' }, 'Todos'),
          facet.values.map((entry) =>
            h('option', {
              key: entry.value, value: entry.value, selected: entry.value === current,
            }, `${entry.value} (${entry.count})`))));
    }),

    h('label', { className: 'facet' },
      h('span', { className: 'facet__label' }, 'Desde'),
      h('input', {
        className: `input facet__select ${dateFrom ? 'is-active' : ''}`.trim(),
        type: 'date', value: dateFrom,
        onChange: (event) => onDates(event.target.value, dateTo),
      })),
    h('label', { className: 'facet' },
      h('span', { className: 'facet__label' }, 'Hasta'),
      h('input', {
        className: `input facet__select ${dateTo ? 'is-active' : ''}`.trim(),
        type: 'date', value: dateTo,
        onChange: (event) => onDates(dateFrom, event.target.value),
      })),

    anyActive
      ? h('button', { className: 'chip filterbar__clear', onClick: onClear }, 'Limpiar filtros')
      : null,
  );
}
