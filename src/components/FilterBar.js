/**
 * Everything that narrows a table, laid out so the common cases take one click.
 *
 *   [ Buscar en cualquier campo…                 ] [ Más filtros (2) ]
 *   PERÍODO   Todo · Esta semana · Este mes · … | 📅 Elegir fechas ▾
 *   ESTADO    Todos · Aprobada 812 · Pendiente 120 · …      (multi-select)
 *   [Cliente: ACME ✕] [Este mes ✕] Limpiar todo        1.284 órdenes · USD …
 *
 * The backend decides which columns are worth filtering and which values
 * exist, with counts; one of them (`quickFacet`) is promoted to chips, the
 * rest live in the «Más filtros» dialog. Every active filter shows as a chip
 * that removes it, so nothing narrows the table out of sight.
 */
import { h, useState } from '../core/runtime.js';
import { PERIOD_PRESETS } from '../lib/periods.js';
import * as fmt from '../lib/format.js';
import { Button } from './Button.js';
import { Field, Select } from './Field.js';
import { FilterIcon } from './icons.js';
import { Modal } from './Modal.js';
import { PeriodBar } from './PeriodBar.js';

/** A facet's chosen values as a list, whether one value or several were picked. */
function chosen(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function FilterBar({
  search, onSearch,
  facets = [], values = {}, onFacet, labelFor, valueLabel = (_facet, value) => value,
  quickFacet = null, quickFacets = null,
  period = 'all', dateFrom = '', dateTo = '', onPeriod,
  onClear, summary = null,
}) {
  const [open, setOpen] = useState(false);

  // Facets promoted to chip rows, in the order asked; the rest go to the dialog.
  const quickKeys = quickFacets || (quickFacet ? [quickFacet] : []);
  const quickRows = quickKeys
    .map((key) => facets.find((facet) => facet.key === key))
    .filter((facet) => facet && facet.values.length);
  const others = facets.filter((facet) => !quickKeys.includes(facet.key));
  const othersActive = others.filter((facet) => chosen(values[facet.key]).length).length;

  /** Adds or removes one value of a chip row; none chosen means all. */
  const toggleQuick = (facet, value) => {
    const current = chosen(values[facet.key]);
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onFacet(facet.key, next.length ? next : '');
  };

  // One removable chip per thing that narrows the rows.
  const active = [];
  if (search.trim()) {
    active.push({ key: 'q', label: `«${search.trim()}»`, remove: () => onSearch('') });
  }
  if (period !== 'all' && (dateFrom || dateTo)) {
    const name = period === 'range'
      ? `${fmt.dateLabel(dateFrom)} – ${fmt.dateLabel(dateTo)}`
      : PERIOD_PRESETS.find((item) => item.key === period)?.label;
    active.push({ key: 'period', label: name, remove: () => onPeriod('all', '', '') });
  }
  for (const facet of facets) {
    const picked = chosen(values[facet.key]);
    for (const value of picked) {
      active.push({
        key: `${facet.key}:${value}`,
        label: `${labelFor(facet)}: ${valueLabel(facet, value)}`,
        remove: () => {
          const rest = picked.filter((item) => item !== value);
          onFacet(facet.key, Array.isArray(values[facet.key]) && rest.length ? rest : '');
        },
      });
    }
  }

  const dialog = open && h(Modal, {
    title: 'Más filtros', className: 'modal--filters', onClose: () => setOpen(false),
    footer: [
      othersActive
        ? h(Button, {
            key: 'clear',
            onClick: () => others.forEach((facet) => onFacet(facet.key, '')),
          }, 'Quitar estos filtros')
        : null,
      h(Button, { key: 'done', variant: 'primary', onClick: () => setOpen(false) }, 'Listo'),
    ],
  },
    others.length === 0
      ? h('p', { className: 'modal__lead' }, 'Los datos actuales no ofrecen más columnas para filtrar.')
      : h('div', { className: 'filters-grid' },
          others.map((facet) => h(Field, { key: facet.key, label: labelFor(facet) },
            h(Select, {
              value: chosen(values[facet.key])[0] || '',
              onChange: (event) => onFacet(facet.key, event.target.value),
              options: [
                { value: '', label: 'Todos' },
                ...facet.values.map((entry) => ({
                  value: entry.value,
                  label: `${valueLabel(facet, entry.value)} (${fmt.integer(entry.count)})`,
                })),
              ],
            })))));

  return h('div', { className: 'filters' },
    h('div', { className: 'filterbar' },
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
        className: `filterbar__toggle ${othersActive ? 'is-active' : ''}`.trim(),
        onClick: () => setOpen(true),
        'aria-haspopup': 'dialog',
        'aria-expanded': open ? 'true' : 'false',
      },
        h(FilterIcon, { size: 15 }),
        h('span', null, 'Más filtros'),
        othersActive ? h('span', { className: 'filterbar__count' }, String(othersActive)) : null)),

    onPeriod ? h(PeriodBar, { preset: period, from: dateFrom, to: dateTo, onChange: onPeriod }) : null,

    quickRows.map((facet) => {
      const picked = chosen(values[facet.key]);
      return h('div', { key: facet.key, className: 'periodbar' },
        h('span', { className: 'periodbar__label' }, labelFor(facet)),
        h('div', { className: 'periodbar__chips', role: 'group', 'aria-label': labelFor(facet) },
          h('button', {
            type: 'button',
            className: `chip ${picked.length ? '' : 'is-active'}`.trim(),
            'aria-pressed': picked.length ? 'false' : 'true',
            onClick: () => onFacet(facet.key, ''),
          }, 'Todos'),
          facet.values.map((entry) => {
            const on = picked.includes(entry.value);
            return h('button', {
              key: entry.value,
              type: 'button',
              className: `chip ${on ? 'is-active' : ''}`.trim(),
              'aria-pressed': on ? 'true' : 'false',
              onClick: () => toggleQuick(facet, entry.value),
            }, valueLabel(facet, entry.value),
            h('span', { className: 'chip__count' }, fmt.integer(entry.count)));
          })));
    }),

    active.length || summary ? h('div', { className: 'filters__active' },
      h('div', { className: 'filters__chips' },
        active.map((item) => h('button', {
          key: item.key, type: 'button', className: 'tag-chip',
          onClick: item.remove, title: 'Quitar este filtro',
        }, h('span', null, item.label), h('span', { className: 'tag-chip__x', 'aria-hidden': 'true' }, '✕'))),
        active.length > 1
          ? h('button', { type: 'button', className: 'filters__clear', onClick: onClear }, 'Limpiar todo')
          : null),
      summary ? h('div', { className: 'filters__summary' }, summary) : null) : null,

    dialog || null,
  );
}
