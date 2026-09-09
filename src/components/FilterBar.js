/**
 * Search box plus a «Filtros» button that opens every other filter in a dialog.
 *
 * The backend decides which columns are worth filtering and which values
 * exist (with counts); this component paints a search input, a button with
 * the number of active filters, and a dialog with one select per facet and a
 * date range. On a phone the dialog fills the screen.
 */
import { h, useState } from '../core/runtime.js';
import { Button } from './Button.js';
import { Field, Select, TextInput } from './Field.js';
import { FilterIcon } from './icons.js';
import { Modal } from './Modal.js';

export function FilterBar({
  search, onSearch,
  facets = [], values = {}, onFacet, labelFor, valueLabel = (_facet, value) => value,
  dateFrom = '', dateTo = '', onDates,
  onClear,
}) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.values(values).filter((value) => value).length
    + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const dialog = open && h(Modal, {
    title: 'Filtros', className: 'modal--filters', onClose: () => setOpen(false),
    footer: [
      activeCount
        ? h(Button, { key: 'clear', onClick: () => { onClear(); } }, 'Limpiar filtros')
        : null,
      h(Button, { key: 'done', variant: 'primary', onClick: () => setOpen(false) }, 'Listo'),
    ],
  },
    facets.length === 0
      ? h('p', { className: 'modal__lead' }, 'Los datos actuales no ofrecen columnas para filtrar.')
      : null,
    h('div', { className: 'filters-grid' },
      facets.map((facet) => h(Field, { key: facet.key, label: labelFor(facet) },
        h(Select, {
          value: values[facet.key] || '',
          onChange: (event) => onFacet(facet.key, event.target.value),
          options: [
            { value: '', label: 'Todos' },
            ...facet.values.map((entry) => ({
              value: entry.value,
              label: `${valueLabel(facet, entry.value)} (${entry.count})`,
            })),
          ],
        }))),
      h(Field, { label: 'Desde' },
        h(TextInput, {
          type: 'date', value: dateFrom,
          onInput: (event) => onDates(event.target.value, dateTo),
        })),
      h(Field, { label: 'Hasta' },
        h(TextInput, {
          type: 'date', value: dateTo,
          onInput: (event) => onDates(dateFrom, event.target.value),
        }))));

  return h('div', { className: 'filterbar' },
    h('label', { className: 'filterbar__search' },
      h('input', {
        className: 'input',
        type: 'search',
        placeholder: 'Buscar en cualquier campo…',
        value: search,
        onInput: (event) => onSearch(event.target.value),
        'aria-label': 'Buscar en cualquier campo',
      })),
    h(Button, {
      className: `filterbar__toggle ${activeCount ? 'is-active' : ''}`.trim(),
      onClick: () => setOpen(true),
      'aria-haspopup': 'dialog',
      'aria-expanded': open ? 'true' : 'false',
    },
      h(FilterIcon, { size: 15 }),
      h('span', null, 'Filtros'),
      activeCount ? h('span', { className: 'filterbar__count' }, String(activeCount)) : null),
    dialog || null,
  );
}
