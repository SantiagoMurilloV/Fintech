/** Expenses table, month KPIs and Cloudinary receipt uploads. */
import { h, useMemo, useState } from '../core/runtime.js';
import { api, withToken } from '../core/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useRowEdits } from '../hooks/useRowEdits.js';
import * as fmt from '../lib/format.js';
import { columnLabel, editableValue, inputTypeFor } from '../lib/columns.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { DataTable } from '../components/DataTable.js';
import { EditableCell } from '../components/EditableCell.js';
import { FileModal, previewKind } from '../components/FileModal.js';
import { MagicPencilIcon } from '../components/icons.js';
import { KpiCard } from '../components/KpiCard.js';
import { PageHeader } from '../components/PageHeader.js';

export function ExpensesView({ onOpenModal, refreshKey, onChanged }) {
  const { data, loading, error, reload } = useAsync(() => api.listExpenses(), [refreshKey]);
  const [uploadingId, setUploadingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [receipt, setReceipt] = useState(null);   // receipt shown in the viewer
  const [rows, applyRow] = useRowEdits(data?.items || [], data);

  /** Saves one field of one expense and keeps the row the backend returns. */
  const saveField = async (expense, field, value) => {
    const { item } = await api.updateExpense(expense.id, { [field]: value });
    applyRow(item);
    onChanged?.();
  };

  const saveCustom = async (expense, key, value) => {
    await api.setCell('expenses', expense.id, key, value);
    applyRow({ ...expense, extra: { ...(expense.extra || {}), [key]: value } });
    onChanged?.();
  };

  const cloudinaryEnabled = data?.cloudinary ?? false;

  /** El lápiz mágico: el backend genera el comprobante con los datos de la fila. */
  const generateReceipt = async (expense) => {
    setGeneratingId(expense.id);
    try {
      const { item } = await api.generateReceipt(expense.id);
      applyRow(item);
      onChanged?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  /** Opens a file picker and attaches the receipt to the given expense. */
  const uploadReceipt = (expense) => {
    if (!cloudinaryEnabled) {
      alert('Cloudinary no está configurado en el backend (CLOUDINARY_URL).');
      return;
    }
    const input = Object.assign(document.createElement('input'), {
      type: 'file',
      accept: '.pdf,image/*',
    });
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      setUploadingId(expense.id);
      try {
        await api.uploadReceipt(expense.id, file);
        reload();
        onChanged?.();
      } catch (err) {
        alert(err.message);
      } finally {
        setUploadingId(null);
      }
    };
    input.click();
  };

  const columns = useMemo(() => [
    {
      key: 'description', header: 'Concepto', width: '1.5fr',
      render: (e) => h(EditableCell, {
        value: e.description,
        display: h('span', { className: 'strong' }, e.description),
        onSave: (next) => saveField(e, 'description', next),
      }),
    },
    {
      key: 'category', header: 'Categoría', width: '1fr',
      render: (e) => h(EditableCell, {
        value: e.category,
        display: h(Badge, { tone: 'neutral' }, e.category),
        onSave: (next) => saveField(e, 'category', next),
      }),
    },
    {
      key: 'vendor', header: 'Proveedor', width: '1.1fr',
      render: (e) => h(EditableCell, {
        value: e.vendor || '',
        display: h('span', { className: 'muted' }, e.vendor || '—'),
        onSave: (next) => saveField(e, 'vendor', next),
      }),
    },
    {
      key: 'amount', header: 'Monto', width: '1fr', align: 'right',
      render: (e) => h(EditableCell, {
        value: e.amount, type: 'number', align: 'right',
        display: h('span', { className: 'num' },
          fmt.amount(e.amount, e.currency), ' ',
          h('span', { className: 'currency' }, e.currency)),
        onSave: (next) => saveField(e, 'amount', next),
      }),
    },
    {
      key: 'owner', header: 'Responsable', width: '1fr',
      render: (e) => h(EditableCell, {
        value: e.owner || '',
        display: h('span', { className: 'muted' }, e.owner || '—'),
        onSave: (next) => saveField(e, 'owner', next),
      }),
    },
    {
      key: 'date', header: 'Fecha', width: '120px', align: 'right',
      render: (e) => h(EditableCell, {
        value: e.date, type: 'date', align: 'right',
        display: h('span', { className: 'muted' }, fmt.shortDate(e.date)),
        onSave: (next) => saveField(e, 'date', next),
      }),
    },
    {
      key: 'receipt', header: 'Comprobante', width: '130px', align: 'right',
      render: (e) => {
        if (e.receipt_url) {
          // Receipts open in the viewer; only what cannot be previewed links out.
          return previewKind(e.receipt_url)
            ? h('button', {
                className: 'link',
                onClick: () => setReceipt({ name: e.receipt_name || e.description, url: e.receipt_url }),
              }, 'Ver comprobante')
            : h('a', { className: 'link', href: withToken(e.receipt_url), target: '_blank', rel: 'noopener' }, 'Ver comprobante');
        }
        if (uploadingId === e.id) return h('span', { className: 'muted' }, 'Subiendo…');
        if (generatingId === e.id) return h('span', { className: 'muted' }, 'Generando…');
        // Sin comprobante: el lápiz mágico lo genera con los datos de la fila.
        return h('span', { className: 'receipt-actions' },
          h('button', {
            className: 'icon-button receipt-magic',
            title: 'Generar el comprobante con los datos de este gasto',
            'aria-label': `Generar comprobante del gasto ${e.id}`,
            onClick: () => generateReceipt(e),
          }, h(MagicPencilIcon)),
          e.receipt_name
            ? h('span', { className: 'muted' }, e.receipt_name)
            : h('button', { className: 'link', onClick: () => uploadReceipt(e) },
                cloudinaryEnabled ? 'Subir…' : '— Falta'));
      },
    },
    ...(data?.columns || []).map((column) => ({
      key: column.key,
      header: columnLabel(column),
      width: 'minmax(110px, 1fr)',
      align: column.data_type === 'number' || column.data_type === 'formula' ? 'right' : undefined,
      render: (e) => h(EditableCell, {
        value: editableValue(e.extra?.[column.key], column.data_type),
        type: inputTypeFor(column.data_type),
        align: column.data_type === 'number' || column.data_type === 'formula' ? 'right' : undefined,
        // A computed column is the formula's output; it is never typed in.
        readOnly: column.data_type === 'formula',
        display: fmt.customCell(e.extra?.[column.key], column.data_type),
        onSave: (next) => saveCustom(e, column.key, next),
      }),
    })),
  ], [cloudinaryEnabled, uploadingId, generatingId, data?.columns]);

  const stats = data?.stats;

  const wide = (data?.columns?.length || 0) > 2;

  return h('div', { className: `page ${wide ? 'page--wide' : ''}`.trim() },
    h(PageHeader, {
      title: 'Gastos',
      subtitle: `Gastos operativos del período${data ? ` · ${fmt.periodName(data.period)}` : ''}`,
      actions: [
        h(Button, { key: 'import', onClick: () => onOpenModal('import', { kind: 'expenses' }) }, 'Importar Excel'),
        h(Button, { key: 'new', variant: 'primary', onClick: () => onOpenModal('new-expense') }, 'Registrar gasto'),
      ],
    }),

    stats
      ? h('div', { className: 'kpi-row' },
          h(KpiCard, { label: 'Total del mes', value: `${fmt.usdCompact(stats.month_total_usd)} eq.` }),
          h(KpiCard, { label: 'Sin comprobante', value: `${stats.missing_receipts} gastos` }),
          h(KpiCard, { label: 'Mayor categoría', value: stats.top_category || '—' }))
      : null,

    receipt ? h(FileModal, { ...receipt, onClose: () => setReceipt(null) }) : null,

    error
      ? h('p', { className: 'form-error' }, error.message)
      : h(DataTable, {
          columns,
          rows,
          rowKey: (e) => e.id,
          loading,
          // Base columns plus room for whatever the source added: the table
          // grows with the data and the card scrolls when the screen ends.
          minWidth: `${840 + (data?.columns?.length || 0) * 140}px`,
          empty: 'Todavía no hay gastos registrados.',
        }));
}
