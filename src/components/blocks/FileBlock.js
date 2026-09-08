/** Downloadable file produced by the agent (PDF, image, sheet). */
import { h, useState } from '../../core/runtime.js';
import { withToken } from '../../core/api.js';
import { FileModal, previewKind } from '../FileModal.js';

const ICONS = { pdf: '▤', image: '▣', sheet: '▦', text: '▤' };

export function FileBlock({ name, url, kind = 'pdf', description }) {
  const [open, setOpen] = useState(false);
  // What can be read in place opens in the modal; the rest keeps the plain link.
  const inline = previewKind(url, kind);

  const body = [
    h('span', { className: 'block-file__icon', 'aria-hidden': 'true' }, ICONS[kind] || '▤'),
    h('span', { className: 'block-file__body' },
      h('span', { className: 'block-file__name' }, name),
      description ? h('span', { className: 'block-file__desc' }, description) : null),
    h('span', { className: 'block-file__action' }, inline ? 'Ver' : 'Abrir'),
  ];

  if (!inline) {
    return h('a', {
      className: 'block block-file', href: withToken(url), target: '_blank', rel: 'noopener',
    }, ...body);
  }

  return h('div', { className: 'block-file__wrap' },
    h('button', {
      className: 'block block-file block-file--button',
      onClick: () => setOpen(true),
    }, ...body),
    open ? h(FileModal, { name, url, kind, onClose: () => setOpen(false) }) : null);
}
