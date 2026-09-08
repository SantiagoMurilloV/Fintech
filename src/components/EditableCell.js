/**
 * Table cell that edits in place.
 *
 * Click it and the value turns into an input already focused. Leaving the
 * field or pressing Enter saves; Escape puts it back. There is no save button
 * on purpose: the row is the form.
 *
 * Saving is optimistic — the new value stays on screen while the request runs
 * and rolls back if the backend rejects it, so a failed edit never leaves the
 * table showing something the database does not have.
 */
import { h, useEffect, useRef, useState } from '../core/runtime.js';

// Cell type -> <input type>; anything else is typed as text.
const INPUT_TYPES = { number: 'number', date: 'date', datetime: 'datetime-local' };

const IDLE = 'idle';
const SAVING = 'saving';
const SAVED = 'saved';
const FAILED = 'failed';

// How long the "guardado" tick stays before fading out.
const SAVED_MS = 1400;

export function EditableCell({
  value,
  // How the value reads when not being edited; defaults to the raw value.
  display,
  // 'text' | 'number' | 'date' | 'datetime' | 'select'
  type = 'text',
  options = [],
  placeholder = '—',
  align,
  // (newValue) => Promise. Rejecting rolls the cell back and shows why.
  onSave,
  // Field is shown but cannot be edited (computed columns, ids).
  readOnly = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [shown, setShown] = useState(value);
  const [status, setStatus] = useState(IDLE);
  const [error, setError] = useState('');
  const input = useRef(null);
  const timer = useRef(null);
  // Escape removes the focused field, and detaching it makes the browser fire
  // blur — which would save the very edit being cancelled.
  const cancelling = useRef(false);

  // A reload from the server wins over a stale local value.
  useEffect(() => {
    if (!editing && status !== SAVING) {
      setShown(value);
      setDraft(value ?? '');
    }
  }, [value]);

  useEffect(() => {
    if (!editing || !input.current) return;
    // A <select> receives its props before its options exist, so the value
    // assigned during the patch was dropped and the field would show the
    // first option — and save that one on blur. Assigning it here, once the
    // options are in the DOM, is what makes it show the current value.
    input.current.value = draft ?? '';
    input.current.focus();
    if (input.current.select) input.current.select();
  }, [editing]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (next) => {
    setStatus(next);
    clearTimeout(timer.current);
    if (next === SAVED) {
      timer.current = setTimeout(() => setStatus(IDLE), SAVED_MS);
    }
  };

  const commit = async () => {
    if (cancelling.current) {
      cancelling.current = false;
      return;
    }
    // The field itself is the source of truth: leaving the cell can land
    // before the state update from the last keystroke has been applied, and
    // reading the stale draft would silently save the old value.
    const typed = input.current ? input.current.value : draft;
    setEditing(false);
    const next = type === 'number' ? Number(typed) : String(typed ?? '').trim();

    if (next === '' && type !== 'number' && (value ?? '') === '') return;
    if (String(next) === String(value ?? '')) return;          // nothing moved
    if (type === 'number' && !Number.isFinite(next)) {
      setError('Tiene que ser un número.');
      flash(FAILED);
      return;
    }

    const previous = shown;
    setShown(next);                                            // optimistic
    setError('');
    flash(SAVING);
    try {
      await onSave(next);
      flash(SAVED);
    } catch (err) {
      setShown(previous);
      setDraft(previous ?? '');
      setError(err?.message || 'No se pudo guardar.');
      flash(FAILED);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelling.current = true;
      setDraft(shown ?? '');
      setEditing(false);
      setError('');
    }
  };

  const classes = ['cell', align === 'right' ? 'cell--right' : '',
                   readOnly ? 'cell--locked' : '', `is-${status}`]
    .filter(Boolean).join(' ');

  if (readOnly) {
    return h('span', { className: classes }, display ?? shown ?? placeholder);
  }

  if (!editing) {
    return h('button', {
      className: `${classes} cell--button`,
      title: 'Clic para editar',
      onClick: () => { cancelling.current = false; setDraft(shown ?? ''); setEditing(true); },
    },
      h('span', { className: 'cell__value' },
        display ?? (shown === null || shown === undefined || shown === '' ? placeholder : shown)),
      status === SAVING ? h('span', { className: 'cell__flag' }, '…') : null,
      status === SAVED ? h('span', { className: 'cell__flag cell__flag--ok' }, '✓') : null,
      status === FAILED
        ? h('span', { className: 'cell__flag cell__flag--bad', title: error }, '!')
        : null);
  }

  const common = {
    ref: input,
    className: 'cell__input',
    value: draft ?? '',
    onInput: (event) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown,
  };

  return h('span', { className: `${classes} cell--editing` },
    type === 'select'
      ? h('select', { ...common, onChange: (event) => setDraft(event.target.value) },
          // An option with `items` is a group: a long list of positions reads
          // by section instead of as one stream of names.
          options.map((option) => (option.items
            ? h('optgroup', { key: option.label, label: option.label },
                option.items.map((item) =>
                  h('option', { key: item.value, value: item.value }, item.label)))
            : h('option', { key: option.value, value: option.value }, option.label))))
      : h('input', {
          ...common,
          type: INPUT_TYPES[type] || 'text',
          step: type === 'number' ? 'any' : undefined,
        }),
    error ? h('span', { className: 'cell__error' }, error) : null);
}
