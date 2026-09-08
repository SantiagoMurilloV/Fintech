/** Sign-in screen. */
import { h, useState } from '../core/runtime.js';
import { APP_NAME } from '../config.js';
import { Button } from '../components/Button.js';
import { Field, FormError, PasswordInput, TextInput } from '../components/Field.js';
import { Logo } from '../components/Logo.js';

export function LoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    // Read the fields from the form, not from state: a password manager that
    // fills and submits in one go does it before the state update lands.
    const fields = event.target.elements;
    const submitted = {
      email: (fields.email?.value ?? email).trim(),
      password: fields.password?.value ?? password,
    };
    if (!submitted.email || !submitted.password) {
      setError('Escriba su correo y contraseña.');
      return;
    }

    setError('');
    setBusy(true);
    try {
      await onLogin(submitted.email, submitted.password);
    } catch (err) {
      setError(err.message);
    } finally {
      // Always release the button: a failure that left it spinning would look
      // like the panel is thinking when it already gave up.
      setBusy(false);
    }
  };

  return h('main', { className: 'login' },
    h('div', { className: 'login__box' },
      h('header', { className: 'login__head' },
        h(Logo, { size: 44, radius: '16px' }),
        h('h1', { className: 'login__title' }, APP_NAME),
        h('p', { className: 'login__subtitle' }, 'Panel financiero para equipos B2B')),

      h('form', { className: 'card login__card', onSubmit: submit },
        h(Field, { label: 'Correo corporativo' },
          h(TextInput, {
            name: 'email', type: 'email', value: email, autocomplete: 'username',
            placeholder: 'nombre@empresa.co',
            onInput: (e) => setEmail(e.target.value),
          })),
        h(Field, { label: 'Contraseña' },
          h(PasswordInput, {
            name: 'password', value: password,
            autocomplete: 'current-password',
            placeholder: '••••••••',
            onInput: (e) => setPassword(e.target.value),
          })),
        h(FormError, { message: error }),
        h(Button, { variant: 'primary', type: 'submit', disabled: busy },
          busy ? 'Ingresando…' : 'Ingresar')),

      h('p', { className: 'login__legal' },
        'Acceso restringido · Datos cifrados en tránsito y reposo')));
}
