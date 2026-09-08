/** Button primitive. Variants: primary | ghost | subtle. */
import { h } from '../core/runtime.js';

export function Button({ variant = 'ghost', type = 'button', disabled, onClick, className = '', children, ...rest }) {
  return h(
    'button',
    {
      type,
      disabled,
      onClick,
      className: `btn btn--${variant} ${className}`.trim(),
      ...rest,
    },
    children,
  );
}
