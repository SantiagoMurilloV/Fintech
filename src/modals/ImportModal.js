/**
 * Excel/CSV import in two steps: check, then load.
 *
 *   1. «Revisar archivo»: the backend reads and checks the file and writes
 *      NOTHING. The dialog shows what would be loaded — rows read, valid and
 *      rejected, totals per month taken from the file, and the exceptions.
 *   2. «Confirmar e importar»: the backend loads it and answers with the
 *      reconciliation (file vs panel, month by month), shown right away.
 *
 * Every import stays in the history (Importaciones), where it can be checked
 * again later. Parsing and validation happen in the backend only.
 */
import { h, useState } from '../core/runtime.js';
import { api, download } from '../core/api.js';
import { navigate } from '../core/router.js';
import * as fmt from '../lib/format.js';
import { IMPORT_KIND_LABELS } from '../lib/labels.js';
import { Button } from '../components/Button.js';
import { FileDropzone } from '../components/FileDropzone.js';
import { FormError } from '../components/Field.js';
import { Modal } from '../components/Modal.js';
import { ReconciliationTable, ReconciliationVerdict } from '../components/Reconciliation.js';

const money = (value) => fmt.amount(value, 'USD');

/** What the file holds, per month, before anything is written. */
function FileTotals({ totals, otc }) {
  const months = Object.keys(totals || {}).sort();
  if (!months.length) return null;
  const sum = (key) => months.reduce((acc, m) => acc + (totals[m][key] || 0), 0);
  return h('div', { className: 'recon' },
    h('div', { className: 'recon__scroll' },
      h('table', { className: 'recon__table' },
        h('thead', null, h('tr', null,
          h('th', null, 'Mes'),
          h('th', { className: 'is-num' }, 'Filas'),
          h('th', { className: 'is-num' }, 'Volumen (USD)'),
          otc ? h('th', { className: 'is-num' }, 'Utilidad') : null)),
        h('tbody', null,
          months.map((m) => h('tr', { key: m },
            h('td', null, fmt.periodName(m)),
            h('td', { className: 'is-num' }, fmt.integer(totals[m].rows)),
            h('td', { className: 'is-num' }, money(totals[m].volume)),
            otc ? h('td', { className: 'is-num' }, money(totals[m].profit)) : null)),
          h('tr', { className: 'recon__total' },
            h('td', null, 'Total'),
            h('td', { className: 'is-num' }, fmt.integer(sum('rows'))),
            h('td', { className: 'is-num' }, money(sum('volume'))),
            otc ? h('td', { className: 'is-num' }, money(sum('profit'))) : null)))));
}

function Exceptions({ batch }) {
  const counts = batch.exception_counts || {};
  const rejected = batch.exceptions?.rechazadas || [];
  const duplicates = batch.exceptions?.posibles_duplicados || [];
  const corrected = batch.exceptions?.fechas_corregidas || [];
  if (!rejected.length && !duplicates.length && !corrected.length) {
    return h('p', { className: 'note note--success' }, 'Sin excepciones: todas las filas son válidas.');
  }
  return h('div', { className: 'import-exceptions' },
    rejected.length ? h('details', { open: true },
      h('summary', null, `${fmt.integer(counts.rechazadas)} filas rechazadas (no se cargarán)`),
      h('pre', { className: 'note note--warning' },
        rejected.map((r) => `Fila ${r.fila}: ${r.motivo}`).join('\n'))) : null,
    corrected.length ? h('details', null,
      h('summary', null, `${fmt.integer(counts.fechas_corregidas)} fechas con año corregido`),
      h('pre', { className: 'note' },
        corrected.map((r) => `Fila ${r.fila}: ${r.original} → ${r.corregida}`).join('\n'))) : null,
    duplicates.length ? h('details', null,
      h('summary', null, `${fmt.integer(counts.posibles_duplicados)} grupos de filas que parecen repetidas (se cargan; revíselas)`),
      h('pre', { className: 'note' },
        duplicates.map((d) => `${d.fecha} · ${d.cliente} · ${money(d.usd)} × ${d.veces}`
          + (d.filas ? ` (filas ${d.filas.join(', ')})` : '')).join('\n'))) : null);
}

export function ImportModal({ kind, onClose, onImported }) {
  const kindLabel = IMPORT_KIND_LABELS[kind] || kind;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);   // the checked file, not loaded yet
  const [done, setDone] = useState(null);         // the applied import + reconciliation
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (work) => {
    setError('');
    setBusy(true);
    try { await work(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const check = () => run(async () => { setPreview(await api.previewImport(kind, file)); });
  const confirm = () => run(async () => {
    setDone(await api.confirmImport(preview.id));
    setPreview(null);
    setFile(null);
    onImported();
  });
  const cancel = () => run(async () => {
    if (preview) await api.discardImport(preview.id);
    setPreview(null);
  });

  const footer = done
    ? [h(Button, { key: 'history', onClick: () => { onClose(); navigate('imports'); } }, 'Ver historial'),
       h(Button, { key: 'close', variant: 'primary', onClick: onClose }, 'Cerrar')]
    : preview
      ? [h(Button, { key: 'cancel', disabled: busy, onClick: cancel }, 'Cancelar'),
         h(Button, { key: 'ok', variant: 'primary', disabled: busy || !preview.rows_valid, onClick: confirm },
           busy ? 'Importando…' : `Confirmar e importar ${fmt.integer(preview.rows_valid)} filas`)]
      : [h(Button, { key: 'close', onClick: onClose }, 'Cerrar'),
         h(Button, { key: 'check', variant: 'primary', disabled: !file || busy, onClick: check },
           busy ? 'Revisando…' : 'Revisar archivo')];

  return h(Modal, { title: `Importar ${kindLabel} desde Excel`, onClose, footer, className: 'modal--import' },
    !preview && !done ? [
      h('p', { key: 'lead', className: 'modal__lead' },
        'Suba un archivo .xlsx o .csv. Primero se revisa y le mostramos qué se cargará; nada se escribe hasta que confirme. '
        + 'Un libro OTC (Date, Client, Direction, Wire USD Sent…) se reconoce solo.'),
      h(FileDropzone, { key: 'drop', accept: '.xlsx,.xls,.csv', file, onSelect: setFile }),
      h('button', {
        key: 'tpl', className: 'link',
        onClick: () => download(`/api/import/template/${kind}`, `template_${kind}.xlsx`),
      }, `Descargar plantilla de ${kindLabel} (.xlsx)`),
    ] : null,

    preview ? [
      h('div', { key: 'head', className: 'import-head' },
        h('strong', null, preview.label || kindLabel),
        h('span', null, ` · ${preview.filename}`)),
      preview.message ? h('p', { key: 'dup', className: 'note note--warning' }, preview.message) : null,
      h('div', { key: 'counts', className: 'import-counts' },
        h('span', null, h('b', null, fmt.integer(preview.rows_read)), ' filas leídas'),
        h('span', null, h('b', null, fmt.integer(preview.rows_valid)), ' válidas'),
        h('span', { className: preview.rows_rejected ? 'is-bad' : '' },
          h('b', null, fmt.integer(preview.rows_rejected)), ' rechazadas')),
      h(FileTotals, { key: 'totals', totals: preview.totals, otc: preview.kind === 'otc' }),
      h(Exceptions, { key: 'exc', batch: preview }),
      preview.kind === 'otc'
        ? h('p', { key: 'note', className: 'modal__lead' },
            `Confirmar reemplaza todas las operaciones de ${preview.label?.replace('Libro OTC ', '')} por las de este archivo.`)
        : null,
    ] : null,

    done ? [
      h('p', { key: 'msg', className: 'note note--success' }, `${done.message || ''} Importación #${done.id}.`),
      h(ReconciliationVerdict, { key: 'verdict', reconciliation: done.reconciliation }),
      h(ReconciliationTable, { key: 'table', reconciliation: done.reconciliation }),
      h('button', {
        key: 'xlsx', className: 'link',
        onClick: () => download(`/api/imports/${done.id}/exceptions.xlsx`, `importacion_${done.id}.xlsx`),
      }, 'Descargar conciliación y excepciones (.xlsx)'),
    ] : null,

    h(FormError, { message: error }));
}
