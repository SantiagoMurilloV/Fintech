/**
 * Carga del historial: cuentas hacia abajo, meses hacia la derecha.
 *
 * Dos pasos. «Revisar» lee el archivo sin guardar nada y muestra lo que
 * encontró: los meses, las cifras nuevas o cambiadas, los totales del archivo
 * contra la fórmula del plan, las cifras que el archivo trae dos veces
 * distintas y las cuentas que no están en el plan. «Guardar cifras» repite la
 * lectura y escribe. Todo se procesa en el backend.
 */
import { h, useState } from '../core/runtime.js';
import { api, download } from '../core/api.js';
import { figure, periodName } from '../lib/format.js';
import { Button } from '../components/Button.js';
import { FileDropzone } from '../components/FileDropzone.js';
import { FormError } from '../components/Field.js';
import { Modal } from '../components/Modal.js';

export function StatementImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');                 // 'check' | 'save'

  const pick = (selected) => { setFile(selected); setReport(null); setError(''); };

  const run = async (dryRun) => {
    if (!file) return;
    setBusy(dryRun ? 'check' : 'save');
    setError('');
    try {
      const result = await api.importPlanValues(file, dryRun);
      setReport(result);
      if (!dryRun) onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const saved = report && !report.dry_run;
  const toWrite = report ? report.written + report.updated : 0;

  return h(Modal, {
    title: 'Cargar cifras del plan de cuentas',
    onClose,
    className: 'modal--wide',
    footer: [
      h(Button, { key: 'close', onClick: onClose }, saved ? 'Listo' : 'Cerrar'),
      saved ? null : h(Button, {
        key: 'check', disabled: !file || Boolean(busy), onClick: () => run(true),
      }, busy === 'check' ? 'Revisando…' : 'Revisar'),
      saved ? null : h(Button, {
        key: 'save', variant: 'primary',
        disabled: !report || !toWrite || Boolean(busy), onClick: () => run(false),
      }, busy === 'save' ? 'Guardando…' : toWrite ? `Guardar ${toWrite} cifras` : 'Guardar cifras'),
    ].filter(Boolean),
  },
    h('p', { className: 'modal__lead' },
      'Suba un Excel o CSV con las cuentas en la primera columna y un mes por columna '
      + '(«2026-05», «May/2026» o «Mayo 2026»). Puede traer varias hojas y años. '
      + 'Primero se revisa; nada se guarda hasta que usted lo confirme.'),

    h(FileDropzone, { accept: '.xlsx,.xls,.csv', file, onSelect: pick }),

    h('button', {
      className: 'link',
      onClick: () => download('/api/plan/values/template.xlsx', 'cifras_plan_de_cuentas.xlsx')
        .catch((err) => setError(err.message)),
    }, 'Descargar plantilla con las cuentas del plan (.xlsx)'),

    h(FormError, { message: error }),

    report ? h(ImportReport, { report }) : null);
}

function ImportReport({ report }) {
  const months = report.periods.length;
  return h('div', { className: 'import-report' },
    h('p', { className: `note ${report.dry_run ? '' : 'note--success'}`.trim() },
      report.dry_run ? 'Revisión (todavía no se guardó nada): ' : 'Guardado: ',
      `${months} ${months === 1 ? 'mes' : 'meses'}`,
      months ? ` (${periodName(report.periods[0])} a ${periodName(report.periods[months - 1])})` : '',
      ` · ${report.written} cifras nuevas · ${report.updated} cambiadas · ${report.unchanged} iguales`,
      report.checked ? ` · ${report.matched} de ${report.checked} totales cuadran` : ''),

    report.sheets.length > 1
      ? h('p', { className: 'muted import-report__sheets' },
          'Hojas: ', report.sheets.map((sheet) =>
            `${sheet.name} (${sheet.rows} filas${sheet.months.length ? '' : ', sin meses'})`).join(' · '))
      : null,

    report.mismatches.length
      ? h('div', { className: 'import-report__block' },
          h('h3', null, 'Totales que no cuadran'),
          h('p', { className: 'muted' },
            'El archivo trae un total distinto al que da la fórmula del plan con las cifras de sus '
            + 'cuentas. El total no se guarda: se calcula. Revise cuál de los dos está bien.'),
          h('div', { className: 'import-report__table' },
            h('div', { className: 'import-report__row is-head' },
              h('span', null, 'Cuenta'), h('span', null, 'Mes'),
              h('span', { className: 'is-right' }, 'Archivo'),
              h('span', { className: 'is-right' }, 'Fórmula'),
              h('span', { className: 'is-right' }, 'Diferencia')),
            report.mismatches.map((item, index) => h('div', {
              key: index, className: 'import-report__row', title: item.where,
            },
              h('span', null, item.account),
              h('span', null, periodName(item.period)),
              h('span', { className: 'is-right' }, figure(item.file)),
              h('span', { className: 'is-right' }, figure(item.computed)),
              h('span', { className: 'is-right is-bad' },
                item.difference != null ? figure(item.difference, 'usd', { signed: true }) : '—')))))
      : null,

    report.problems.length
      ? h('div', { className: 'import-report__block' },
          h('h3', null, 'Para revisar'),
          h('ul', { className: 'import-report__list is-bad' },
            report.problems.map((problem, index) => h('li', { key: index }, problem))))
      : null,

    report.notes.length
      ? h('ul', { className: 'import-report__list muted' },
          report.notes.map((note, index) => h('li', { key: index }, note)))
      : null);
}
