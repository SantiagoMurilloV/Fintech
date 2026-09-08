/** Single-select chip row used for table filters. */
import { h } from '../core/runtime.js';

export function FilterChips({ options, value, onChange }) {
  return h('div', { className: 'chips', role: 'tablist' },
    options.map((option) =>
      h('button', {
        key: option.value,
        className: `chip ${option.value === value ? 'is-active' : ''}`.trim(),
        role: 'tab',
        'aria-selected': option.value === value,
        onClick: () => onChange(option.value),
      }, option.label)));
}
