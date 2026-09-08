/** Modal dialog with backdrop dismissal and Escape support. */
import { h, useEffect } from '../core/runtime.js';

export function Modal({ title, onClose, children, footer, className = '' }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('is-modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('is-modal-open');
    };
  }, []);

  return h('div', {
    className: 'modal-backdrop',
    // Only a click on the backdrop itself closes the dialog.
    onClick: (event) => { if (event.target === event.currentTarget) onClose(); },
  },
    h('div', {
      className: `modal ${className}`.trim(),
      role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
    },
      h('header', { className: 'modal__head' },
        h('h2', null, title),
        h('button', { className: 'modal__close', onClick: onClose, 'aria-label': 'Cerrar' }, '✕')),
      h('div', { className: 'modal__body' }, children),
      footer ? h('footer', { className: 'modal__foot' }, footer) : null,
    ));
}
