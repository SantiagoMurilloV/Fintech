/**
 * Forced password change.
 *
 * An account an admin just created (or reset) carries a one-time password, so
 * the panel stops here until the person picks their own. Nothing else is
 * reachable in the meantime.
 */
import { h, useState } from '../core/runtime.js';
import { APP_NAME } from '../config.js';
import { Button } from '../components/Button.js';
import { Field, FormError, PasswordInput } from '../components/Field.js';
import { Logo } from '../components/Logo.js';

const MIN_LENGTH = 8;

export function ChangePasswordView({ email, onSubmit, onCancel }) {
  const [currentState, setCurrent] = useState('');
  const [nextState, setNext] = useState('');
  const [repeatState, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    // Same reason as the sign-in form: the field is the source of truth.
    const fields = event.target.elements;
    const current = fields.current?.value ?? currentState;
    const next = fields.next?.value ?? nextState;
    const repeat = fields.repeat?.value ?? repeatState;

    if (next.length < MIN_LENGTH) {
      setError(`La contraseña nueva debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (next !== repeat) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onSubmit(current, next);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return h('main', { className: 'login' },
    h('div', { className: 'login__box' },
      h('header', { className: 'login__head' },
        h(Logo, { size: 44, radius: '16px' }),
        h('h1', { className: 'login__title' }, APP_NAME),
        h('p', { className: 'login__subtitle' },
          'Elija su contraseña para terminar de activar la cuenta')),

      h('form', { className: 'card login__card', onSubmit: submit },
        h('p', { className: 'login__account' }, email),
        h(Field, { label: 'Contraseña temporal' },
          h(PasswordInput, {
            name: 'current', value: currentState, autocomplete: 'current-password',
            onInput: (e) => setCurrent(e.target.value),
          })),
        h(Field, { label: 'Contraseña nueva', hint: `Mínimo ${MIN_LENGTH} caracteres` },
          h(PasswordInput, {
            name: 'next', value: nextState, autocomplete: 'new-password',
            onInput: (e) => setNext(e.target.value),
          })),
        h(Field, { label: 'Repetila' },
          h(PasswordInput, {
            name: 'repeat', value: repeatState, autocomplete: 'new-password',
            onInput: (e) => setRepeat(e.target.value),
          })),
        h(FormError, { message: error }),
        h(Button, { variant: 'primary', type: 'submit', disabled: busy },
          busy ? 'Guardando…' : 'Guardar y entrar'),
        onCancel
          ? h(Button, { onClick: onCancel, disabled: busy }, 'Salir')
          : null),

      h('p', { className: 'login__legal' },
        'Al cambiarla se cierran las demás sesiones de esta cuenta')));
}
