/**
 * Where a record came from, as a small tag with a coloured dot: the same
 * colour for an origin everywhere (Excel OTC, QuickBooks, Endpoint…), so a
 * QuickBooks invoice never passes for an OTC trade.
 */
import { h } from '../core/runtime.js';
import { originLabel } from '../lib/labels.js';

export function OriginTag({ origin }) {
  // An older backend sends no origin: say nothing rather than call it «Manual».
  if (!origin) return h('span', { className: 'muted' }, '—');
  const code = origin;
  return h('span', { className: `origin-tag origin-tag--${code}`, title: `Origen: ${originLabel(code)}` },
    h('span', { className: 'origin-tag__dot', 'aria-hidden': 'true' }),
    originLabel(code));
}
