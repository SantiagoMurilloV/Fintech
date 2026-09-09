/** Orders table with search, data-driven filters, pagination and exports. */
import { h, useEffect, useMemo, useState } from '../core/runtime.js';
import { PAGE_SIZE } from '../config.js';
import { api, download, orderQuery } from '../core/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useRowEdits } from '../hooks/useRowEdits.js';
import { statusLabel, statusTone } from '../lib/labels.js';
import * as fmt from '../lib/format.js';
import { columnLabel, editableValue, inputTypeFor } from '../lib/columns.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { DataTable, TablePager } from '../components/DataTable.js';
import { EditableCell } from '../components/EditableCell.js';
import { FilterBar } from '../components/FilterBar.js';
import { PageHeader } from '../components/PageHeader.js';

/** Milliseconds of quiet typing before a search hits the API. */
const SEARCH_DELAY = 300;

/** Spanish names for the base columns the backend may offer as filters. */
const BASE_FACET_LABELS = {
  status: 'Estado',
  currency: 'Moneda',
  gateway: 'Pasarela',
  customer: 'Cliente',
  source_status: 'Estado origen',
};

/**
 * Header of a base column. When the rows came from a sync, the feed's own
 * field name sits under ours, so «Cliente» says it is really `legal_name`.
 */
function sourceHeader(label, sourceField) {
  if (!sourceField) return label;
  return h('span', { className: 'th-sourced' }, label,
    h('span', { className: 'th-source mono' }, sourceField));
}

export function OrdersView({ onOpenModal, refreshKey, onChanged }) {
  const [offset, setOffset] = useState(0);
  // What the person is typing, and the settled text the API is asked for.
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typed.trim() !== q) { setQ(typed.trim()); setOffset(0); }
    }, SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [typed]);

  // Everything that selects rows, shared by the listing and the CSV export.
  // Status is one more facet inside `filters`.
  const query = { q, filters, dateFrom, dateTo };
  const filtersKey = JSON.stringify(filters);

  const { data, loading, error } = useAsync(
    () => api.listOrders({ ...query, limit: PAGE_SIZE, offset }),
    [q, filtersKey, dateFrom, dateTo, offset, refreshKey],
  );

  const setFacet = (key, value) => {
    setFilters((current) => {
      const next = { ...current };
      if (value) next[key] = value; else delete next[key];
      return next;
    });
    setOffset(0);
  };

  /** Clears what the dialog holds; the search box stays as typed. */
  const clearFilters = () => {
    setFilters({}); setDateFrom(''); setDateTo(''); setOffset(0);
  };

  /** Header for a facet: base columns have fixed names, feed columns their own. */
  const facetLabel = (facet) => {
    if (BASE_FACET_LABELS[facet.key]) return BASE_FACET_LABELS[facet.key];
    const column = (data?.columns || []).find((c) => c.key === facet.key);
    return columnLabel(column || { key: facet.key, label: facet.key });
  };

  /** Option text for a facet value: status codes get their Spanish label. */
  const facetValueLabel = (facet, value) => (facet.key === 'status' ? statusLabel(value) : value);

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

  // Base columns plus any user-defined column the backend reports. A base
  // column the data never fills is hidden, and one fed by a sync shows the
  // source field under its header: the table follows the data, not a template.
  const source = data?.source_fields || {};
  const hidden = data?.empty_fields || [];
  const columns = useMemo(() => [
    { key: 'id', header: sourceHeader('ID orden', source.external_id), width: '110px', render: (o) => h('span', { className: 'mono' }, o.id) },
    {
      key: 'customer', header: sourceHeader('Cliente', source.customer), width: '1.6fr',
      render: (o) => h(EditableCell, {
        value: o.customer,
        display: h('span', { className: 'strong' }, o.customer),
        onSave: (next) => saveField(o, 'customer', next),
      }),
    },
    {
      key: 'amount', header: sourceHeader('Monto', source.amount), width: '1.2fr', align: 'right',
      render: (o) => h(EditableCell, {
        value: o.amount, type: 'number', align: 'right',
        display: h('span', { className: 'num' },
          fmt.amount(o.amount, o.currency), ' ',
          h('span', { className: 'currency' }, o.currency)),
        onSave: (next) => saveField(o, 'amount', next),
      }),
    },
    {
      key: 'status', header: sourceHeader('Estado', source.status), width: 'minmax(150px, 1.4fr)',
      render: (o) => h(EditableCell, {
        value: o.status, type: 'select',
        options: (data?.statuses || []).map((code) => ({ value: code, label: statusLabel(code) })),
        // The feed's own words when they exist; our category colours the badge
        // and shows on hover, so nothing the source said is rewritten.
        display: h(Badge, {
          tone: statusTone(o.status),
          title: o.source_status ? statusLabel(o.status) : undefined,
        }, o.source_status || statusLabel(o.status)),
        onSave: (next) => saveField(o, 'status', next),
      }),
    },
    {
      key: 'gateway', header: sourceHeader('Pasarela', source.gateway), width: '130px',
      render: (o) => h(EditableCell, {
        value: o.gateway || '', type: 'select',
        options: [{ value: '', label: '—' },
                  ...(data?.gateways || []).map((name) => ({ value: name, label: name }))],
        display: h('span', { className: 'muted' }, o.gateway || '—'),
        onSave: (next) => saveField(o, 'gateway', next),
      }),
    },
    {
      key: 'date', header: sourceHeader('Fecha', source.date), width: '120px', align: 'right',
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
  ].filter((column) => !hidden.includes(column.key)),
  [data?.columns, data?.statuses, data?.gateways, data?.source_fields, data?.empty_fields]);


  const total = data?.total || 0;

  const wide = (data?.columns?.length || 0) > 2;

  return h('div', { className: `page ${wide ? 'page--wide' : ''}`.trim() },
    h(PageHeader, {
      title: 'Órdenes',
      subtitle: `Transacciones procesadas${data ? ` · ${fmt.periodName(data.period)}` : ''}`,
      actions: [
        h(Button, { key: 'import', onClick: () => onOpenModal('import', { kind: 'orders' }) }, 'Importar Excel'),
        h(Button, { key: 'csv', onClick: () => download(`/api/orders/export.csv?${orderQuery(query)}`, 'orders.csv') }, 'Exportar CSV'),
        h(Button, { key: 'new', variant: 'primary', onClick: () => onOpenModal('new-order', { catalogs: data }) }, 'Nueva orden'),
      ],
    }),

    h(FilterBar, {
      search: typed, onSearch: setTyped,
      facets: data?.facets || [], values: filters, onFacet: setFacet,
      labelFor: facetLabel, valueLabel: facetValueLabel,
      dateFrom, dateTo,
      onDates: (from, to) => { setDateFrom(from); setDateTo(to); setOffset(0); },
      onClear: clearFilters,
    }),

    error
      ? h('p', { className: 'form-error' }, error.message)
      : h(DataTable, {
          columns,
          rows,
          minWidth: `${920 + (data?.columns?.length || 0) * 140}px`,
          rowKey: (o) => o.id,
          loading,
          empty: data?.filtered ? 'Ninguna orden coincide con la búsqueda.' : 'No hay órdenes con este filtro.',
          footer: h(TablePager, {
            summary: `Mostrando ${rows.length} de ${fmt.integer(total)} órdenes${data?.filtered ? ' que coinciden' : ''}`,
            canPrev: offset > 0,
            canNext: offset + rows.length < total,
            onPrev: () => setOffset(Math.max(offset - PAGE_SIZE, 0)),
            onNext: () => setOffset(offset + PAGE_SIZE),
          }),
        }));
}
