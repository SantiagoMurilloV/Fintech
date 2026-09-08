/**
 * In-app viewer for the files the agent produces.
 *
 * A report or a receipt opens here instead of in another tab, so reading it
 * never loses the conversation behind it. PDFs render in an iframe and images
 * inline; anything else falls back to the download action.
 *
 * The viewer authenticates through `?token=` because an iframe cannot send the
 * Authorization header.
 */
import { h, useState } from '../core/runtime.js';
import { withToken } from '../core/api.js';
import { Modal } from './Modal.js';
import { Button } from './Button.js';

const PDF_PATTERN = /\.pdf(\?|$)/i;
const IMAGE_PATTERN = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i;

/** What the viewer can show inline: 'pdf', 'image' or null. */
export function previewKind(url, kind) {
  if (!url) return null;
  if (kind === 'pdf' || PDF_PATTERN.test(url)) return 'pdf';
  if (kind === 'image' || IMAGE_PATTERN.test(url)) return 'image';
  return null;
}

export function FileModal({ name, url, kind, onClose }) {
  const [failed, setFailed] = useState(false);
  const source = withToken(url);
  const preview = previewKind(url, kind);

  const openInTab = () => window.open(source, '_blank', 'noopener');

  // The backend serves files inline so they can be read here; asking for the
  // download is what switches it to an attachment.
  const save = () => {
    const link = Object.assign(document.createElement('a'), {
      href: `${source}${source.includes('?') ? '&' : '?'}download=1`,
      download: name || '',
    });
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return h(Modal, {
    title: name || 'Documento',
    className: 'modal--file',
    onClose,
    footer: h('div', { className: 'file-modal__actions' },
      h(Button, { variant: 'ghost', onClick: onClose }, 'Cerrar'),
      h(Button, { onClick: save }, 'Descargar'),
      h(Button, { onClick: openInTab }, 'Abrir en pestaña')),
  },
    h('div', { className: 'file-modal' },
      failed || !preview
        ? h('div', { className: 'file-modal__fallback' },
            h('p', null, preview
              ? 'No se pudo mostrar el documento aquí.'
              : 'Este archivo no se puede previsualizar.'),
            h(Button, { onClick: openInTab }, 'Abrirlo en una pestaña'))
        : preview === 'pdf'
          ? h('iframe', {
              className: 'file-modal__frame',
              src: source,
              title: name || 'Documento',
              onError: () => setFailed(true),
            })
          : h('img', {
              className: 'file-modal__image',
              src: source,
              alt: name || 'Imagen',
              onError: () => setFailed(true),
            })));
}
