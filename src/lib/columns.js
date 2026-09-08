/**
 * Helpers for user-defined columns — the ones the backend reports per table.
 *
 * The backend only knows a column's key, label and data type; how that maps
 * to a header, an input and an editable value is decided here, once, for
 * every table that shows custom columns.
 */

/**
 * Spanish headers for the fields external feeds send most often.
 *
 * A column the sync creates is labelled with the feed's own field name
 * (`amount_out`); a person reading the panel expects «Monto salida».
 */
const FEED_FIELD_LABELS = {
  amount_in: 'Monto entrada',
  amount_out: 'Monto salida',
  currency_in: 'Moneda entrada',
  currency_out: 'Moneda salida',
  network: 'Red',
  country: 'País',
  document_number: 'Documento',
  operation_type: 'Tipo de operación',
  payment_spreader: 'Spreader',
  created_at: 'Creada',
  updated_at: 'Actualizada',
  legal_name: 'Razón social',
  pid: 'PID',
  status: 'Estado',
  fee: 'Comisión',
  rate: 'Tasa',
  reference: 'Referencia',
  description: 'Descripción',
  category: 'Categoría',
  type: 'Tipo',
  email: 'Correo',
  phone: 'Teléfono',
};

/** True when the label is just the key: nobody chose it, the feed did. */
const looksLikeKey = (label) => /^[a-z0-9_]+$/.test(label);

/**
 * Header for a column.
 *
 * A label a person typed («IVA 19%») is shown as is. A label that is only the
 * feed's field name is translated when known and made readable otherwise
 * (`payment_method` → «Payment method»).
 */
export function columnLabel(column) {
  const label = column.label || column.key || '';
  if (!looksLikeKey(label)) return label;
  if (FEED_FIELD_LABELS[label]) return FEED_FIELD_LABELS[label];
  const words = label.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Input type EditableCell uses for a column's data type. */
export function inputTypeFor(dataType) {
  if (dataType === 'number') return 'number';
  if (dataType === 'date') return 'date';
  if (dataType === 'datetime') return 'datetime';
  return 'text';
}

/** The stored value as the input needs it: datetime-local wants YYYY-MM-DDTHH:MM. */
export function editableValue(value, dataType) {
  if (value === null || value === undefined) return '';
  if (dataType === 'datetime') return String(value).slice(0, 16);
  return value;
}
