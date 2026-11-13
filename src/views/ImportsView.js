/**
 * Import history: every file loaded, who and when, and whether it still
 * reconciles with the panel.
 *
 * The list recomputes each import's check live (file totals vs what the
 * panel holds now), so an import that was edited or partly deleted after the
 * fact turns ✗ by itself. Opening one shows the month-by-month
 * reconciliation, the rows changed since, and every exception, with a
 * workbook to download for the finance team.
 */
import { h, useState } from '../core/runtime.js';
import { api, download } from '../core/api.js';
import { useAsync } from '../hooks/useAsync.js';
import * as fmt from '../lib/format.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { DataTable } from '../components/DataTable.js';
import { PageHeader } from '../components/PageHeader.js';
import { ReconciliationTable, ReconciliationVerdict } from '../components/Reconciliation.js';

const STATUS = {
  applied: ['Aplicada', 'success'], superseded: ['Reemplazada', 'neutral'],
  preview: ['Sin confirmar', 'warning'], discarded: ['Descartada', 'neutral'],
};

function Verdict({ item }) {
  if (item.ok === true) return h('span', { className: 'recon__ok' }, '✓ Cuadra');
  if (item.ok === false) return h('span', { className: 'recon__bad' }, '✗ No cuadra');
  return h('span', { className: 'muted' }, '—');
}

function Detail({ id, onBack }) {
  const { data, loading, error, reload } = useAsync(() => api.getImport(id), [id]);
  if (loading && !data) return h('p', { className: 'muted' }, 'Cargando la importación…');
  if (error) return h('p', { className: 'form-error' }, error.message);
  const b = data;
  const rec = b.reconciliation || {};
  const exceptions = b.exceptions || {};
  const [statusLabel, tone] = STATUS[b.status] || [b.status, 'neutral'];
  const facts = [
    ['Archivo', b.filename], ['Subido por', b.uploaded_by || '—'],
    ['Subido', fmt.dateTimeLabel(b.uploaded_at)], ['Aplicado', b.applied_at ? fmt.dateTimeLabel(b.applied_at) : '—'],
    ['Filas leídas', fmt.integer(b.rows_read)], ['Válidas', fmt.integer(b.rows_valid)],
    ['Rechazadas', fmt.integer(b.rows_rejected)], ['Cargadas', fmt.integer(b.rows_loaded)],
    ['Reemplazadas', fmt.integer(b.rows_replaced)], ['Ya no estaban en el archivo', fmt.integer(b.rows_removed)],
    ['Huella del archivo (SHA-256)', `${(b.file_sha256 || '').slice(0, 16)}…`],
  ];
  const lines = (list, render) => (list || []).map(render).join('\n');
  return h('div', { className: 'import-detail' },
    h('div', { className: 'import-detail__bar' },
      h(Button, { onClick: onBack }, '← Volver'),
      h(Button, { onClick: reload }, 'Volver a verificar'),
      h(Button, { variant: 'primary', onClick: () => download(`/api/imports/${b.id}/exceptions.xlsx`, `importacion_${b.id}.xlsx`) },
        'Descargar conciliación (.xlsx)')),
    h('h2', { className: 'import-detail__title' }, `#${b.id} · ${b.label || b.kind} `,
      h(Badge, { tone }, statusLabel)),
    b.message ? h('p', { className: 'muted' }, b.message) : null,
    h('dl', { className: 'facts' }, facts.map(([k, v]) => [h('dt', { key: `${k}t` }, k), h('dd', { key: `${k}d` }, v)])),
    h(ReconciliationVerdict, { reconciliation: rec }),
    h(ReconciliationTable, { reconciliation: rec }),
    (rec.changed || []).length ? h('details', { open: true },
      h('summary', null, `${fmt.integer(rec.changed.length)} filas editadas después de importar`),
      h('pre', { className: 'note note--warning' },
        lines(rec.changed, (c) => `${c.id} · fila ${c.fila ?? '—'} del archivo · ${c.fecha}`))) : null,
    (exceptions.rechazadas || []).length ? h('details', null,
      h('summary', null, `${fmt.integer(b.exception_counts.rechazadas)} filas rechazadas`),
      h('pre', { className: 'note note--warning' }, lines(exceptions.rechazadas, (r) => `Fila ${r.fila}: ${r.motivo}`))) : null,
    (exceptions.fechas_corregidas || []).length ? h('details', null,
      h('summary', null, `${fmt.integer(b.exception_counts.fechas_corregidas)} fechas con año corregido`),
      h('pre', { className: 'note' }, lines(exceptions.fechas_corregidas, (r) => `Fila ${r.fila}: ${r.original} → ${r.corregida}`))) : null,
    (exceptions.posibles_duplicados || []).length ? h('details', null,
      h('summary', null, `${fmt.integer(b.exception_counts.posibles_duplicados)} grupos de filas que parecen repetidas`),
      h('pre', { className: 'note' }, lines(exceptions.posibles_duplicados,
        (d) => `${d.fecha} · ${d.cliente} · ${fmt.amount(d.usd, 'USD')} × ${d.veces}${d.filas ? ` (filas ${d.filas.join(', ')})` : ''}`))) : null,
    b.exception_counts && Object.values(b.exception_counts).some((n) => n > 50)
      ? h('p', { className: 'muted' }, 'Aquí se muestran las primeras 50 de cada lista; el .xlsx las trae todas.')
      : null);
}

export function ImportsView({ refreshKey }) {
  const [openId, setOpenId] = useState(null);
  const { data, loading, error, reload } = useAsync(() => api.listImports(), [refreshKey, openId]);

  if (openId) return h('div', { className: 'page' },
    h(PageHeader, { title: 'Importaciones', subtitle: 'Conciliación de la importación' }),
    h(Detail, { id: openId, onBack: () => setOpenId(null) }));

  const columns = [
    { key: 'id', header: '#', width: '56px', render: (b) => h('span', { className: 'mono' }, `#${b.id}`) },
    { key: 'label', header: 'Importación', width: '1.4fr', render: (b) => h('span', null,
        h('strong', null, b.label || b.kind), h('br'), h('span', { className: 'muted' }, b.filename)) },
    { key: 'when', header: 'Subido', width: '1fr', render: (b) => h('span', null,
        fmt.dateTimeLabel(b.uploaded_at), h('br'), h('span', { className: 'muted' }, b.uploaded_by || '')) },
    { key: 'rows', header: 'Filas', width: '1fr', align: 'right', render: (b) => h('span', { className: 'num' },
        `${fmt.integer(b.rows_loaded)} de ${fmt.integer(b.rows_read)}`,
        b.rows_rejected ? h('span', { className: 'recon__bad' }, ` · ${fmt.integer(b.rows_rejected)} rechazadas`) : null) },
    { key: 'status', header: 'Estado', width: '120px', render: (b) => {
        const [label, tone] = STATUS[b.status] || [b.status, 'neutral'];
        return h(Badge, { tone }, label);
      } },
    { key: 'ok', header: 'Conciliación', width: '130px', render: (b) => h(Verdict, { item: b }) },
    { key: 'open', header: '', width: '90px', align: 'right',
      render: (b) => h('button', { className: 'link', onClick: () => setOpenId(b.id) }, 'Ver detalle') },
  ];

  return h('div', { className: 'page page--wide' },
    h(PageHeader, {
      title: 'Importaciones',
      subtitle: 'Cada archivo cargado, quién y cuándo, y si sigue cuadrando con el panel',
      actions: [h(Button, { key: 'reload', onClick: reload }, 'Volver a verificar')],
    }),
    error ? h('p', { className: 'form-error' }, error.message) : h(DataTable, {
      columns, rows: data?.items || [], rowKey: (b) => b.id, loading, minWidth: '900px',
      empty: 'Todavía no hay importaciones registradas. Importe un archivo desde Órdenes o Gastos.',
    }));
}
