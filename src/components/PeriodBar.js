/**
 * «Período» chip row: one click picks a common period, «Elegir fechas» opens a small
 * popover with two dates.
 *
 * The bar only reports what was chosen (preset key plus its dates); the view
 * decides what to query. A typed range is validated here so the API is never
 * asked for half a range or for one that ends before it starts.
 */
import { h, useEffect, useRef, useState } from '../core/runtime.js';
import * as fmt from '../lib/format.js';
import { PERIOD_PRESETS, presetRange, rangeProblem } from '../lib/periods.js';
import { Button } from './Button.js';
import { CalendarIcon, ChevronDownIcon } from './icons.js';

export function PeriodBar({ preset = 'all', from = '', to = '', onChange }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [problem, setProblem] = useState(null);
  // Where the date picker sits, so the popover opens right under it.
  const [anchor, setAnchor] = useState(0);
  const box = useRef(null);

  // A click outside the popover or Escape closes it, like any menu.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (box.current && !box.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (key, event) => {
    if (key === 'range') {
      // Under the chip, but never past the bar's right edge.
      const chip = event?.currentTarget;
      const room = (box.current?.clientWidth || 0) - 320;
      setAnchor(Math.max(Math.min(chip?.offsetLeft || 0, room), 0));
      // Start from what is on screen, so a preset can be widened by a day.
      setDraftFrom(from); setDraftTo(to); setProblem(null); setOpen(!open);
      return;
    }
    setOpen(false);
    const range = presetRange(key);
    onChange(key, range.from, range.to);
  };

  const apply = () => {
    const reason = rangeProblem(draftFrom, draftTo);
    if (reason) { setProblem(reason); return; }
    setOpen(false);
    onChange('range', draftFrom, draftTo);
  };

  const ranged = preset === 'range' && from && to;
  const presets = PERIOD_PRESETS.filter((item) => item.key !== 'range');

  return h('div', { className: 'periodbar', ref: box },
    h('span', { className: 'periodbar__label' }, 'Período'),
    h('div', { className: 'periodbar__chips', role: 'group', 'aria-label': 'Período' },
      presets.map((item) => h('button', {
        key: item.key,
        type: 'button',
        className: `chip ${item.key === preset ? 'is-active' : ''}`.trim(),
        'aria-pressed': item.key === preset ? 'true' : 'false',
        onClick: (event) => choose(item.key, event),
      }, item.label)),
      // Set apart from the presets and drawn as a picker (calendar icon,
      // arrow), so it reads as «choose your own dates», not one more period.
      h('span', { className: 'periodbar__divider', 'aria-hidden': 'true' }),
      h('button', {
        type: 'button',
        className: [
          'range-picker',
          ranged ? 'is-active' : '',
          open ? 'is-open' : '',
        ].filter(Boolean).join(' '),
        'aria-haspopup': 'dialog',
        'aria-expanded': open ? 'true' : 'false',
        title: 'Elegir un rango de fechas',
        onClick: (event) => choose('range', event),
      },
        h(CalendarIcon, { size: 14 }),
        ranged
          ? h('span', { className: 'range-picker__dates' },
              fmt.dateLabel(from), h('span', { className: 'range-picker__sep' }, '→'), fmt.dateLabel(to))
          : h('span', null, 'Elegir fechas'),
        h('span', { className: 'range-picker__chevron' }, h(ChevronDownIcon, { size: 13 })))),

    open ? h('div', {
      className: 'periodbar__popover', role: 'dialog', 'aria-label': 'Rango de fechas',
      // A string: custom properties cannot be assigned through `el.style`.
      style: `--pop-left: ${anchor}px`,
    },
      h('div', { className: 'periodbar__head' },
        h('strong', null, 'Rango de fechas'),
        h('span', null, 'Incluye ambos días.')),
      h('div', { className: 'periodbar__fields' },
        h('label', { className: 'periodbar__field' },
          h('span', null, 'Desde'),
          h('input', {
            className: 'input', type: 'date', value: draftFrom, max: draftTo || undefined,
            onInput: (event) => { setDraftFrom(event.target.value); setProblem(null); },
          })),
        h('label', { className: 'periodbar__field' },
          h('span', null, 'Hasta'),
          h('input', {
            className: 'input', type: 'date', value: draftTo, min: draftFrom || undefined,
            onInput: (event) => { setDraftTo(event.target.value); setProblem(null); },
            onKeyDown: (event) => { if (event.key === 'Enter') apply(); },
          }))),
      problem ? h('p', { className: 'periodbar__problem', role: 'alert' }, problem) : null,
      h('div', { className: 'periodbar__actions' },
        h(Button, { onClick: () => setOpen(false) }, 'Cancelar'),
        h(Button, { variant: 'primary', onClick: apply }, 'Aplicar')))
      : null);
}
