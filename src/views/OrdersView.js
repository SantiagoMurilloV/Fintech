/** Orders table with status filters, pagination and exports. */
import { h, useMemo, useState } from '../core/runtime.js';
import { PAGE_SIZE } from '../config.js';
import { api, download } from '../core/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useRowEdits } from '../hooks/useRowEdits.js';
import { statusLabel, statusTone } from '../lib/labels.js';
import * as fmt from '../lib/format.js';
import { columnLabel, editableValue, inputTypeFor } from '../lib/columns.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { DataTable, TablePager } from '../components/DataTable.js';
import { EditableCell } from '../components/EditableCell.js';
import { FilterChips } from '../components/FilterChips.js';
import { PageHeader } from '../components/PageHeader.js';

const ALL = 'all';

export function OrdersView({ onOpenModal, refreshKey, onChanged }) {
  const [status, setStatus] = useState(ALL);
  const [offset, setOffset] = useState(0);

  const { data, loading, error } = useAsync(
    () => api.listOrders({
      status: status === ALL ? undefined : status,
      limit: PAGE_SIZE,
      offset,
    }),
    [status, offset, refreshKey],
  );

  const filterOptions = useMemo(() => [
    { value: ALL, label: 'Todas' },
    ...(data?.statuses || []).map((code) => ({ value: code, label: statusLabel(code) })),
  ], [data?.statuses]);

  const items = data?.items || [];
  const [rows, applyRow] = useRowEdits(items, data);

  /** Saves one field of one order and keeps the row the backend returns. */
  const saveField = async (order, field, value) => {
    const { item } = await api.updateOrder(order.id, { [field]: value });
    applyRow(item);
    onChanged?.();
  };

  const saveCustom = async (order, key, value) => {
    await api.setCell('orders', order.id, key, value);
    applyRow({ ...order, extra: { ...(order.extra || {}), [key]: value } });
    onChanged?.();
  };

  // Base columns plus any user-defined column the backend reports.
  const columns = useMemo(() => [
    { key: 'id', header: 'ID orden', width: '110px', render: (o) => h('span', { className: 'mono' }, o.id) },
    {
      key: 'customer', header: 'Cliente', width: '1.6fr',
      render: (o) => h(EditableCell, {
        value: o.customer,
        display: h('span', { className: 'strong' }, o.customer),
        onSave: (next) => saveField(o, 'customer', next),
      }),
    },
    {
      key: 'amount', header: 'Monto', width: '1.2fr', align: 'right',
      render: (o) => h(EditableCell, {
        value: o.amount, type: 'number', align: 'right',
        display: h('span', { className: 'num' },
          fmt.amount(o.amount, o.currency), ' ',
          h('span', { className: 'currency' }, o.currency)),
        onSave: (next) => saveField(o, 'amount', next),
      }),
    },
    {
      key: 'status', header: 'Estado', width: '130px',
      render: (o) => h(EditableCell, {
        value: o.status, type: 'select',
        options: (data?.statuses || []).map((code) => ({ value: code, label: statusLabel(code) })),
        display: h(Badge, { tone: statusTone(o.status) }, statusLabel(o.status)),
        onSave: (next) => saveField(o, 'status', next),
      }),
    },
    {
      key: 'gateway', header: 'Pasarela', width: '130px',
      render: (o) => h(EditableCell, {
        value: o.gateway || '', type: 'select',
        options: [{ value: '', label: '—' },
                  ...(data?.gateways || []).map((name) => ({ value: name, label: name }))],
        display: h('span', { className: 'muted' }, o.gateway || '—'),
        onSave: (next) => saveField(o, 'gateway', next),
      }),
    },
    {
      key: 'date', header: 'Fecha', width: '120px', align: 'right',
      render: (o) => h(EditableCell, {
        value: o.date, type: 'date', align: 'right',
        display: h('span', { className: 'muted' }, fmt.shortDate(o.date)),
        onSave: (next) => saveField(o, 'date', next),
      }),
    },
    ...(data?.columns || []).map((column) => ({
      key: column.key,
      header: columnLabel(column),
      width: 'minmax(110px, 1fr)',
      align: column.data_type === 'number' || column.data_type === 'formula' ? 'right' : undefined,
      render: (o) => h(EditableCell, {
        value: editableValue(o.extra?.[column.key], column.data_type),
        type: inputTypeFor(column.data_type),
        align: column.data_type === 'number' || column.data_type === 'formula' ? 'right' : undefined,
        // A computed column is the formula's output; it is never typed in.
        readOnly: column.data_type === 'formula',
        display: fmt.customCell(o.extra?.[column.key], column.data_type),
        onSave: (next) => saveCustom(o, column.key, next),
      }),
    })),
  ], [data?.columns, data?.statuses, data?.gateways]);


  const total = data?.total || 0;

  const wide = (data?.columns?.length || 0) > 2;

  return h('div', { className: `page ${wide ? 'page--wide' : ''}`.trim() },
    h(PageHeader, {
      title: 'Órdenes',
      subtitle: `Transacciones procesadas${data ? ` · ${fmt.periodName(data.period)}` : ''}`,
      actions: [
        h(Button, { key: 'import', onClick: () => onOpenModal('import', { kind: 'orders' }) }, 'Importar Excel'),
        h(Button, { key: 'csv', onClick: () => download('/api/orders/export.csv', 'orders.csv') }, 'Exportar CSV'),
        h(Button, { key: 'new', variant: 'primary', onClick: () => onOpenModal('new-order', { catalogs: data }) }, 'Nueva orden'),
      ],
    }),

    h(FilterChips, {
      options: filterOptions,
      value: status,
      onChange: (next) => { setStatus(next); setOffset(0); },
    }),

    error
      ? h('p', { className: 'form-error' }, error.message)
      : h(DataTable, {
          columns,
          rows,
          minWidth: `${920 + (data?.columns?.length || 0) * 140}px`,
          rowKey: (o) => o.id,
          loading,
          empty: 'No hay órdenes con este filtro.',
          footer: h(TablePager, {
            summary: `Mostrando ${rows.length} de ${fmt.integer(total)} órdenes`,
            canPrev: offset > 0,
            canNext: offset + rows.length < total,
            onPrev: () => setOffset(Math.max(offset - PAGE_SIZE, 0)),
            onNext: () => setOffset(offset + PAGE_SIZE),
          }),
        }));
}
