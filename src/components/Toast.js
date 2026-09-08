/** Corner notification with an optional action. Purely presentational. */
import { h } from '../core/runtime.js';
import { Button } from './Button.js';

export function Toast({ message, actionLabel, onAction, onClose }) {
  return h('div', { className: 'toast', role: 'status' },
    h('p', { className: 'toast__message' }, message),
    h('div', { className: 'toast__actions' },
      actionLabel ? h(Button, { variant: 'primary', onClick: onAction }, actionLabel) : null,
      h('button', {
        className: 'toast__close', onClick: onClose, 'aria-label': 'Cerrar aviso',
      }, '✕')));
}
