/** Labeled form controls used by the modals. */
import { h, useState } from '../core/runtime.js';

export function Field({ label, hint, children }) {
  return h('label', { className: 'field' },
    h('span', { className: 'field__label' }, label),
    children,
    hint ? h('span', { className: 'field__hint' }, hint) : null);
}

export function TextInput({ value, onInput, type = 'text', ...rest }) {
  return h('input', { className: 'input', type, value, onInput, ...rest });
}

export function Select({ value, onChange, options, ...rest }) {
  return h('select', { className: 'input', value, onChange, ...rest },
    options.map((option) => {
      const optionValue = typeof option === 'string' ? option : option.value;
      const optionLabel = typeof option === 'string' ? option : option.label;
      return h('option', {
        key: optionValue,
        value: optionValue,
        selected: optionValue === value,
      }, optionLabel);
    }));
}

/**
 * Password field with a reveal toggle.
 *
 * Typing a long password blind is where sign-ins go wrong, so the eye is there
 * from the start. It only flips the input type; the value never leaves the
 * field and is never copied anywhere.
 */
export function PasswordInput({ value, onInput, name, ...rest }) {
  const [visible, setVisible] = useState(false);
  return h('span', { className: 'password' },
    h('input', {
      className: 'input password__input',
      type: visible ? 'text' : 'password',
      name, value, onInput, ...rest,
    }),
    h('button', {
      type: 'button',
      className: 'password__eye',
      // Announced to screen readers, which cannot see the icon change.
      'aria-label': visible ? 'Ocultar contraseña' : 'Mostrar contraseña',
      'aria-pressed': visible ? 'true' : 'false',
      title: visible ? 'Ocultar' : 'Mostrar',
      onClick: () => setVisible((shown) => !shown),
    }, visible ? EYE_OFF : EYE));
}

// Simple glyphs: the icon set is text-based across the app.
const EYE = '◉';
const EYE_OFF = '◎';

/** Inline error message shown inside forms. */
export function FormError({ message }) {
  return message ? h('p', { className: 'form-error', role: 'alert' }, message) : null;
}
