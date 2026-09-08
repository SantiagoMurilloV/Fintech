/** Excel/CSV import dialog. Parsing and validation happen in the backend. */
import { h, useState } from '../core/runtime.js';
import { api, download } from '../core/api.js';
import { IMPORT_KIND_LABELS } from '../lib/labels.js';
import { Button } from '../components/Button.js';
import { FileDropzone } from '../components/FileDropzone.js';
import { FormError } from '../components/Field.js';
import { Modal } from '../components/Modal.js';

export function ImportModal({ kind, onClose, onImported }) {
  const kindLabel = IMPORT_KIND_LABELS[kind] || kind;
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const response = await api.importExcel(kind, file);
      setResult(response);
      setFile(null);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return h(Modal, {
    title: `Importar ${kindLabel} desde Excel`,
    onClose,
    footer: [
      h(Button, { key: 'close', onClick: onClose }, 'Cerrar'),
      h(Button, { key: 'import', variant: 'primary', disabled: !file || busy, onClick: submit },
        busy ? 'Importando…' : 'Importar'),
    ],
  },
    h('p', { className: 'modal__lead' },
      'Suba un archivo .xlsx o .csv. El servidor valida y procesa cada fila; nada se calcula en el navegador.'),

    h(FileDropzone, { accept: '.xlsx,.xls,.csv', file, onSelect: setFile }),

    h('button', {
      className: 'link',
      onClick: () => download(`/api/import/template/${kind}`, `template_${kind}.xlsx`),
    }, `Descargar plantilla de ${kindLabel} (.xlsx)`),

    h(FormError, { message: error }),

    result
      ? h('div', { className: 'import-result' },
          h('p', { className: 'note note--success' }, result.message),
          result.errors.length
            ? h('pre', { className: 'note note--warning' }, result.errors.join('\n'))
            : null)
      : null);
}
