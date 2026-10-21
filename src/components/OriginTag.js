/**
 * Where a record came from, as a small tag with a coloured dot: the same
 * colour for an origin everywhere (Excel OTC, QuickBooks, Endpoint…), so a
 * QuickBooks invoice never passes for an OTC trade.
 */
import { h } from '../core/runtime.js';
import { originLabel } from '../lib/labels.js';

export function OriginTag({ origin }) {
  const code = origin || 'manual';
  return h('span', { className: `origin-tag origin-tag--${code}`, title: `Origen: ${originLabel(code)}` },
    h('span', { className: 'origin-tag__dot', 'aria-hidden': 'true' }),
    originLabel(code));
}
