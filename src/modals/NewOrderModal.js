/** Create-order form. */
import { h, useState } from '../core/runtime.js';
import { api } from '../core/api.js';
import { statusLabel } from '../lib/labels.js';
import { todayISO } from '../lib/format.js';
import { Button } from '../components/Button.js';
import { Field, FormError, Select, TextInput } from '../components/Field.js';
import { Modal } from '../components/Modal.js';

export function NewOrderModal({ catalogs, onClose, onSaved }) {
  const currencies = catalogs?.currencies || ['COP', 'USD', 'MXN', 'USDT', 'USDC'];
  const statuses = catalogs?.statuses || ['approved', 'pending', 'rejected', 'refunded'];
  const gateways = catalogs?.gateways || [];

  const [form, setForm] = useState({
    customer: '', amount: '', currency: currencies[0], status: 'pending',
    gateway: gateways[0] || '', date: todayISO(),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.createOrder({ ...form, amount: Number(form.amount) });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return h(Modal, {
    title: 'Nueva orden',
    onClose,
    footer: [
      h(Button, { key: 'cancel', onClick: onClose }, 'Cancelar'),
      h(Button, { key: 'save', variant: 'primary', disabled: busy, onClick: submit },
        busy ? 'Creando…' : 'Crear orden'),
    ],
  },
    h(Field, { label: 'Cliente' },
      h(TextInput, { value: form.customer, placeholder: 'Nombre del cliente', onInput: update('customer') })),
    h('div', { className: 'field-row' },
      h(Field, { label: 'Monto' },
        h(TextInput, { type: 'number', min: '0', step: '0.01', value: form.amount, onInput: update('amount') })),
      h(Field, { label: 'Moneda' },
        h(Select, { value: form.currency, options: currencies, onChange: update('currency') }))),
    h('div', { className: 'field-row' },
      h(Field, { label: 'Estado' },
        h(Select, {
          value: form.status,
          options: statuses.map((code) => ({ value: code, label: statusLabel(code) })),
          onChange: update('status'),
        })),
      h(Field, { label: 'Gateway' },
        h(Select, { value: form.gateway, options: gateways, onChange: update('gateway') }))),
    h(Field, { label: 'Fecha' },
      h(TextInput, { type: 'date', value: form.date, onInput: update('date') })),
    h(FormError, { message: error }));
}
