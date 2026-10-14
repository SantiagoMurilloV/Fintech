/**
 * Editor del plan de cuentas.
 *
 * El plan es la lista de cajas donde la empresa ordena su plata, como carpetas
 * dentro de carpetas. Tres tipos de cuenta:
 *   Entrada  una caja que se llena con la cifra del mes (Arriendo = 9.500).
 *   Total    una receta de otras cajas (Utilidad = ingresos - costos); se
 *            calcula siempre, nunca se escribe, así que no puede quedar mal.
 *   Grupo    un título que solo ordena; no lleva cifra.
 *
 * Los cambios quedan en borrador hasta «Guardar plan»; el backend valida el
 * plan completo (claves únicas, fórmulas con cuentas que existen, sin
 * círculos) y devuelve cada problema con el nombre de la cuenta.
 */
import { h, useEffect, useMemo, useState } from '../core/runtime.js';
import { api } from '../core/api.js';
import { navigate } from '../core/router.js';
import { useAsync } from '../hooks/useAsync.js';
import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';

const KINDS = [['input', 'Entrada'], ['total', 'Total'], ['group', 'Grupo']];
const NATURES = [['income', 'Ingreso (subir es bueno)'], ['cost', 'Costo (subir es malo)'],
  ['result', 'Resultado (subir es bueno)']];
const UNITS = [['usd', 'USD'], ['pct', '%'], ['bps', 'Puntos básicos']];
const KIND_LABEL = Object.fromEntries(KINDS);

/** "Gastos de oficina" -> "gastos_de_oficina", único dentro del plan. */
function slugify(name, taken) {
  const base = (name || 'cuenta').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'cuenta';
  const start = /^[a-z]/.test(base) ? base : `c_${base}`;
  let key = start;
  for (let n = 2; taken.has(key); n += 1) key = `${start}_${n}`;
  return key;
}

let lastId = 0;
const nextId = () => `row-${++lastId}`;

/** Una identidad estable por fila: la clave de una cuenta nueva cambia al escribir su nombre. */
const withIds = (accounts) => accounts.map((a) => ({ ...a, _id: nextId() }));

/** La cuenta sin lo que solo usa el editor, para comparar con lo guardado. */
function strip(account) {
  const { _id, _new, _keyTouched, level, ...clean } = account;
  return clean;
}

/** Cuentas en orden de árbol, con su profundidad. */
function ordered(accounts) {
  const keys = new Set(accounts.map((a) => a.key));
  const children = new Map();
  for (const account of accounts) {
    const parent = keys.has(account.parent_key) ? account.parent_key : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(account);
  }
  for (const list of children.values()) list.sort((a, b) => a.position - b.position);
  const out = [];
  const walk = (parent, level) => {
    for (const account of children.get(parent) || []) {
      out.push({ account, level });
      walk(account.key, level + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function PlanView({ isAdmin }) {
  const { data, error, loading, reload } = useAsync(() => api.getPlan(), []);
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(null);             // clave con detalles abiertos
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (data) setDraft(withIds(data.accounts));
  }, [data]);

  const accounts = draft || [];
  const tree = useMemo(() => ordered(accounts), [draft]);
  const dirty = data && JSON.stringify(data.accounts.map(strip)) !== JSON.stringify(accounts.map(strip));

  const change = (id, patch) => {
    setNotice('');
    setDraft((current) => current.map((a) => {
      if (a._id !== id) return a;
      const next = { ...a, ...patch };
      // Una cuenta nueva toma su clave del nombre mientras nadie la fije a mano.
      if (a._new && !a._keyTouched && patch.name !== undefined) {
        const taken = new Set(current.filter((o) => o._id !== id).map((o) => o.key));
        next.key = slugify(patch.name, taken);
        return { ...next, _rekey: a.key };
      }
      if (patch.kind && patch.kind !== 'total') next.formula = '';
      if (patch.key !== undefined && patch.key !== a.key) return { ...next, _rekey: a.key };
      return next;
    }).map((a, _, list) => {
      // Si una clave nueva cambió, sus hijas la siguen.
      const moved = list.find((o) => o._rekey && o._rekey === a.parent_key);
      return moved ? { ...a, parent_key: moved.key } : a;
    }).map(({ _rekey, ...a }) => a));
  };

  const add = (parentKey) => {
    const taken = new Set(accounts.map((a) => a.key));
    const key = slugify('nueva cuenta', taken);
    const siblings = accounts.filter((a) => (a.parent_key || null) === (parentKey || null));
    const id = nextId();
    setDraft([...accounts, {
      _id: id, key, name: 'Nueva cuenta', parent_key: parentKey || null,
      position: siblings.length ? Math.max(...siblings.map((a) => a.position)) + 1 : 0,
      kind: 'input', formula: '', unit: 'usd', nature: 'cost', percent_of: parentKey || null,
      headline: false, definition: '', aliases: [], source: 'manual', _new: true,
    }]);
    setOpen(id);
  };

  const remove = (key) => {
    const doomed = new Set([key]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const a of accounts) {
        if (a.parent_key && doomed.has(a.parent_key) && !doomed.has(a.key)) {
          doomed.add(a.key);
          grew = true;
        }
      }
    }
    const name = accounts.find((a) => a.key === key)?.name;
    const question = doomed.size > 1
      ? `¿Quitar «${name}» y sus ${doomed.size - 1} cuentas internas? Sus cifras se borran al guardar.`
      : `¿Quitar «${name}»? Si tiene cifras, se borran al guardar.`;
    if (!window.confirm(question)) return;
    setDraft(accounts.filter((a) => !doomed.has(a.key)));
  };

  const move = (key, step) => {
    const account = accounts.find((a) => a.key === key);
    const siblings = accounts.filter((a) => (a.parent_key || null) === (account.parent_key || null))
      .sort((a, b) => a.position - b.position);
    const index = siblings.findIndex((a) => a.key === key);
    const other = siblings[index + step];
    if (!other) return;
    setDraft(accounts.map((a) => {
      if (a.key === key) return { ...a, position: other.position };
      if (a.key === other.key) return { ...a, position: account.position };
      return a;
    }));
  };

  const save = async () => {
    setSaving(true);
    setProblems([]);
    setNotice('');
    try {
      // Posiciones limpias y sin marcas internas del editor.
      const payload = tree.map(({ account }, index) => {
        const { _new, _keyTouched, _id, level, ...clean } = account;
        return { ...clean, position: index,
                 aliases: Array.isArray(clean.aliases) ? clean.aliases : String(clean.aliases || '').split(',') };
      });
      const result = await api.savePlan(payload);
      setNotice(result.dropped_values
        ? `Plan guardado. Se borraron ${result.dropped_values} cifras de cuentas que ya no existen.`
        : 'Plan guardado.');
      reload();
    } catch (err) {
      setProblems(err.problems?.length ? err.problems : [err.message]);
    } finally {
      setSaving(false);
    }
  };

  const valued = accounts.filter((a) => a.kind !== 'group');

  return h('div', { className: 'page page--wide' },
    h(PageHeader, {
      title: 'Plan de cuentas',
      subtitle: isAdmin
        ? 'Las cajas donde se ordena la plata de la empresa y cómo se calculan los totales'
        : 'Las cajas donde se ordena la plata de la empresa · solo un administrador puede cambiarlas',
      actions: [
        h(Button, { key: 'back', onClick: () => navigate('statement') }, 'Ver estado de resultados'),
        isAdmin ? h(Button, { key: 'add', onClick: () => add(null) }, 'Agregar cuenta') : null,
        isAdmin && dirty ? h(Button, {
          key: 'discard', onClick: () => { setDraft(withIds(data.accounts)); setProblems([]); },
        }, 'Descartar cambios') : null,
        isAdmin ? h(Button, {
          key: 'save', variant: 'primary', disabled: !dirty || saving, onClick: save,
        }, saving ? 'Guardando…' : dirty ? 'Guardar plan' : 'Sin cambios') : null,
      ].filter(Boolean),
    }),

    notice ? h('p', { className: 'form-notice' }, notice) : null,
    problems.length
      ? h('div', { className: 'form-error plan-problems' },
          h('strong', null, 'El plan no se guardó:'),
          h('ul', null, problems.map((p, i) => h('li', { key: i }, p))))
      : null,
    error ? h('p', { className: 'form-error' }, error.message) : null,
    loading && !data ? h('p', { className: 'muted' }, 'Cargando el plan…') : null,

    data && !accounts.length
      ? h(Card, { className: 'statement-empty' },
          h('p', { className: 'settings__hint' },
            'El plan está vacío. Cargue una plantilla en Configuración o agregue la primera cuenta.'),
          h(Button, { onClick: () => navigate('settings') }, 'Ir a Configuración'))
      : null,

    accounts.length
      ? h(Card, { className: 'table plan' },
          h('div', { className: 'table__head plan__grid' },
            h('div', null, 'Cuenta'), h('div', null, 'Tipo'),
            h('div', null, 'Fórmula (con las claves de las cuentas)'), h('div', null, '')),
          tree.map(({ account, level }) => [
            h(PlanRow, {
              key: account._id, account, level, isAdmin,
              expanded: open === account._id,
              onToggle: () => setOpen(open === account._id ? null : account._id),
              onChange: (patch) => change(account._id, patch),
              onAdd: () => add(account.key),
              onRemove: () => remove(account.key),
              onMove: (step) => move(account.key, step),
            }),
            open === account._id
              ? h(PlanDetails, {
                  key: `${account._id}-details`, account, isAdmin, valued,
                  onChange: (patch) => change(account._id, patch),
                })
              : null,
          ]),
          h('div', { className: 'table__foot' },
            'En una fórmula use las claves (debajo de cada nombre), con + - * / y paréntesis. '
            + 'Ej.: «salaries + rent». Un total puede usar otros totales.'))
      : null);
}

function PlanRow({ account, level, isAdmin, expanded, onToggle, onChange, onAdd, onRemove, onMove }) {
  const indent = { paddingLeft: `${level * 20}px` };
  return h('div', { className: `table__row plan__grid plan__row plan__row--${account.kind}` },
    h('div', { className: 'plan__name', style: indent },
      isAdmin
        ? h('input', {
            className: 'input plan__input', value: account.name,
            onInput: (event) => onChange({ name: event.target.value }),
          })
        : h('span', { title: account.definition || '' }, account.name),
      h('code', { className: 'plan__key' }, account.key)),
    h('div', null,
      isAdmin
        ? h('select', {
            className: 'input plan__input', value: account.kind,
            onChange: (event) => onChange({ kind: event.target.value }),
          }, KINDS.map(([value, label]) =>
            h('option', { key: value, value, selected: value === account.kind }, label)))
        : KIND_LABEL[account.kind]),
    h('div', null,
      account.kind === 'total'
        ? (isAdmin
            ? h('input', {
                className: 'input plan__input plan__formula', value: account.formula || '',
                placeholder: 'ej. ingresos - costos',
                onInput: (event) => onChange({ formula: event.target.value }),
              })
            : h('code', { className: 'plan__formula' }, account.formula))
        : h('span', { className: 'muted' },
            account.kind === 'input' ? 'Se llena con la cifra del mes' : 'Solo ordena')),
    h('div', { className: 'plan__actions is-actions' },
      h('button', { className: 'link', onClick: onToggle }, expanded ? 'Cerrar' : 'Detalles'),
      isAdmin ? [
        h('button', { key: 'up', className: 'plan__icon', title: 'Subir', onClick: () => onMove(-1) }, '↑'),
        h('button', { key: 'down', className: 'plan__icon', title: 'Bajar', onClick: () => onMove(1) }, '↓'),
        h('button', { key: 'add', className: 'plan__icon', title: 'Agregar cuenta adentro', onClick: onAdd }, '＋'),
        h('button', { key: 'del', className: 'plan__icon is-bad', title: 'Quitar', onClick: onRemove }, '✕'),
      ] : null));
}

function PlanDetails({ account, isAdmin, valued, onChange }) {
  const field = (label, control, hint) => h('label', { className: 'field' },
    h('span', null, label), control, hint ? h('small', { className: 'field__hint' }, hint) : null);
  const select = (value, options, patchKey, empty) => h('select', {
    className: 'input', disabled: !isAdmin, value: value || '',
    onChange: (event) => onChange({ [patchKey]: event.target.value || null }),
  }, [
    empty ? h('option', { key: '', value: '', selected: !value }, empty) : null,
    ...options.map(([v, label]) => h('option', { key: v, value: v, selected: v === value }, label)),
  ].filter(Boolean));

  return h('div', { className: 'plan__details' },
    field('Clave', h('input', {
      className: 'input', value: account.key, disabled: !isAdmin || !account._new,
      onInput: (event) => onChange({ key: event.target.value, _keyTouched: true }),
    }), account._new ? 'Así se nombra en las fórmulas. Después de guardar no cambia.'
      : 'Así se nombra en las fórmulas.'),
    field('% vertical de', select(account.percent_of,
      valued.filter((a) => a.key !== account.key).map((a) => [a.key, a.name]),
      'percent_of', 'Ninguna'), 'La línea contra la que se mide (ej. Arriendo como % de Costos fijos).'),
    field('Naturaleza', select(account.nature, NATURES, 'nature'),
      'Decide el color de la variación.'),
    field('Unidad', select(account.unit, UNITS, 'unit'), 'Puntos básicos: 0,14% = 14 pb.'),
    field('Alias', h('input', {
      className: 'input', disabled: !isAdmin,
      value: Array.isArray(account.aliases) ? account.aliases.join(', ') : account.aliases || '',
      onInput: (event) => onChange({ aliases: event.target.value.split(',').map((s) => s.trim()).filter(Boolean) }),
    }), 'Otros nombres con que aparece en sus Excel, separados por coma.'),
    h('label', { className: 'settings__switch' },
      h('input', {
        type: 'checkbox', checked: Boolean(account.headline), disabled: !isAdmin,
        onChange: (event) => onChange({ headline: event.target.checked }),
      }),
      h('span', null, 'Mostrar como indicador principal (tarjeta arriba del estado)')),
    h('label', { className: 'field plan__definition' },
      h('span', null, 'Definición'),
      h('textarea', {
        className: 'input', rows: 2, disabled: !isAdmin, value: account.definition || '',
        onInput: (event) => onChange({ definition: event.target.value }),
      }),
      h('small', { className: 'field__hint' }, 'Qué significa esta cuenta. El agente la usará para explicar.')));
}
