/**
 * Report library: everything the agent has generated — charts, financial
 * PDFs, invoices and receipts.
 */
import { h, useEffect, useRef, useState } from '../core/runtime.js';
import { api } from '../core/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { periodName } from '../lib/format.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { FileModal } from '../components/FileModal.js';
import { FilterChips } from '../components/FilterChips.js';
import { PencilIcon } from '../components/icons.js';
import { PageHeader } from '../components/PageHeader.js';

const KIND_LABELS = {
  chart: 'Gráfico',
  financial: 'Reporte financiero',
  analysis: 'Análisis',
  invoice: 'Factura',
  receipt: 'Comprobante',
};

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'chart', label: 'Gráficos' },
  { value: 'financial', label: 'Financieros' },
  { value: 'analysis', label: 'Análisis' },
  { value: 'invoice', label: 'Facturas' },
  { value: 'receipt', label: 'Comprobantes' },
];

/**
 * Nombre del reporte con un lápiz al lado: al oprimirlo, el mismo campo se
 * vuelve editable. Enter o salir del campo guarda; Escape cancela.
 */
function ReportTitle({ report, onRenamed }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(report.title);
  const [saving, setSaving] = useState(false);
  const input = useRef(null);
  // Escape quita el campo y el navegador dispara blur, que guardaría lo que
  // se estaba cancelando; esta marca lo evita.
  const cancelling = useRef(false);

  useEffect(() => {
    if (editing && input.current) {
      input.current.focus();
      input.current.select();
    }
  }, [editing]);

  const commit = async () => {
    if (cancelling.current) {
      cancelling.current = false;
      return;
    }
    const title = (input.current ? input.current.value : draft).trim();
    setEditing(false);
    if (!title || title === report.title) return;
    setSaving(true);
    try {
      await api.renameSavedReport(report.id, title);
      onRenamed();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelling.current = true;
      setEditing(false);
    }
  };

  if (editing) {
    return h('input', {
      ref: input,
      className: 'library__title-input',
      value: draft,
      'aria-label': 'Nuevo nombre del reporte',
      onInput: (event) => setDraft(event.target.value),
      onBlur: commit,
      onKeyDown,
    });
  }

  return h('h3', { className: 'library__title' },
    h('span', { className: 'library__title-text' }, report.title),
    saving
      ? h('span', { className: 'muted' }, '…')
      : h('button', {
          className: 'icon-button',
          title: 'Cambiar el nombre',
          'aria-label': `Cambiar el nombre de «${report.title}»`,
          onClick: () => { cancelling.current = false; setDraft(report.title); setEditing(true); },
        }, h(PencilIcon)));
}

export function LibraryView({ refreshKey }) {
  const [kind, setKind] = useState('all');
  const [preview, setPreview] = useState(null);   // { id, title, svg }
  const [pdf, setPdf] = useState(null);           // report shown in the PDF viewer
  const { data, loading, error, reload } = useAsync(
    () => api.listSavedReports(kind === 'all' ? undefined : kind),
    [kind, refreshKey],
  );

  const openChart = async (report) => {
    const full = await api.getSavedReport(report.id);
    setPreview(full);
  };

  const remove = async (report) => {
    await api.deleteSavedReport(report.id);
    if (preview?.id === report.id) setPreview(null);
    reload();
  };

  const items = data?.items || [];

  return h('div', { className: 'page' },
    h(PageHeader, {
      title: 'Reportes',
      subtitle: 'Gráficos y documentos generados por el agente',
      actions: [h(Button, { key: 'reload', onClick: reload }, 'Actualizar')],
    }),

    h(FilterChips, { options: FILTERS, value: kind, onChange: setKind }),

    pdf ? h(FileModal, { ...pdf, kind: 'pdf', onClose: () => setPdf(null) }) : null,

    preview
      ? h(Card, { className: 'preview' },
          h('div', { className: 'preview__head' },
            h('h2', null, preview.title),
            h('button', { className: 'preview__close', onClick: () => setPreview(null) }, '✕')),
          h('div', { className: 'preview__canvas', dangerouslySetInnerHTML: preview.svg }))
      : null,

    error ? h('p', { className: 'form-error' }, error.message) : null,

    loading
      ? h('p', { className: 'muted' }, 'Cargando reportes…')
      : items.length === 0
        ? h(Card, { className: 'empty-state' },
            h('p', null, 'Todavía no hay reportes.'),
            h('p', { className: 'muted' },
              'Pídaselos al agente: «grafica los ingresos por semana» o «genera el reporte financiero en PDF».'))
        : h('div', { className: 'library' },
            items.map((report) =>
              h(Card, { key: report.id, className: 'library__item' },
                h('div', { className: 'library__head' },
                  h(Badge, { tone: report.kind === 'financial' ? 'success' : 'neutral' },
                    KIND_LABELS[report.kind] || report.kind),
                  h('span', { className: 'library__date' }, report.created_at.slice(0, 10))),
                h(ReportTitle, { key: `title-${report.id}`, report, onRenamed: reload }),
                report.period
                  ? h('p', { className: 'library__period' }, periodName(report.period))
                  : null,
                report.summary
                  ? h('p', { className: 'library__summary' }, report.summary)
                  : null,
                h('div', { className: 'library__actions' },
                  report.has_chart
                    ? h(Button, { onClick: () => openChart(report) }, 'Ver gráfico')
                    : null,
                  report.pdf_url
                    ? h(Button, {
                        variant: 'primary',
                        onClick: () => setPdf({ name: report.title, url: report.pdf_url }),
                      }, 'Ver PDF')
                    : null,
                  h('button', {
                    className: 'library__delete',
                    'aria-label': 'Eliminar reporte',
                    onClick: () => remove(report),
                  }, 'Eliminar'))))));
}
