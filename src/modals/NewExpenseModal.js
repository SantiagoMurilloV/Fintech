/** Register-expense form, with optional receipt upload to Cloudinary. */
import { h, useState } from '../core/runtime.js';
import { api } from '../core/api.js';
import { todayISO } from '../lib/format.js';
import { Button } from '../components/Button.js';
import { Field, FormError, Select, TextInput } from '../components/Field.js';
import { Modal } from '../components/Modal.js';

const CURRENCIES = ['COP', 'USD', 'MXN', 'USDT', 'USDC'];

export function NewExpenseModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    description: '', category: '', vendor: '', amount: '',
    currency: CURRENCIES[0], owner: '', date: todayISO(),
  });
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const expense = await api.createExpense({
        ...form,
        amount: Number(form.amount),
        vendor: form.vendor || null,
        owner: form.owner || null,
      });
      // The receipt is a second call so the expense exists before uploading.
      if (receipt) await api.uploadReceipt(expense.id, receipt);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return h(Modal, {
    title: 'Registrar gasto',
    onClose,
    footer: [
      h(Button, { key: 'cancel', onClick: onClose }, 'Cancelar'),
      h(Button, { key: 'save', variant: 'primary', disabled: busy, onClick: submit },
        busy ? 'Guardando…' : 'Registrar'),
    ],
  },
    h(Field, { label: 'Concepto' },
      h(TextInput, { value: form.description, placeholder: 'Ej: Licencias SaaS', onInput: update('description') })),
    h('div', { className: 'field-row' },
      h(Field, { label: 'Categoría' },
        h(TextInput, { value: form.category, placeholder: 'Ej: Software', onInput: update('category') })),
      h(Field, { label: 'Proveedor' },
        h(TextInput, { value: form.vendor, placeholder: 'Ej: Atlassian', onInput: update('vendor') }))),
    h('div', { className: 'field-row' },
      h(Field, { label: 'Monto' },
        h(TextInput, { type: 'number', min: '0', step: '0.01', value: form.amount, onInput: update('amount') })),
      h(Field, { label: 'Moneda' },
        h(Select, { value: form.currency, options: CURRENCIES, onChange: update('currency') }))),
    h('div', { className: 'field-row' },
      h(Field, { label: 'Responsable' },
        h(TextInput, { value: form.owner, placeholder: 'Ej: D. Torres', onInput: update('owner') })),
      h(Field, { label: 'Fecha' },
        h(TextInput, { type: 'date', value: form.date, onInput: update('date') }))),
    h(Field, { label: 'Comprobante', hint: 'PDF o imagen — se sube a Cloudinary (opcional)' },
      h('input', {
        className: 'input',
        type: 'file',
        accept: '.pdf,image/*',
        onChange: (event) => setReceipt(event.target.files[0] || null),
      })),
    h(FormError, { message: error }));
}
