/**
 * User management. Only an admin reaches this screen.
 *
 * Creating an account returns a one-time password that is shown once, here,
 * and never again — the backend only keeps its hash. Roles and activation are
 * edited in place like the rest of the tables.
 */
import { h, useMemo, useState } from '../core/runtime.js';
import { api } from '../core/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useRowEdits } from '../hooks/useRowEdits.js';
import { shortDate } from '../lib/format.js';
import { roleLabel, roleOptions } from '../lib/labels.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { DataTable } from '../components/DataTable.js';
import { EditableCell } from '../components/EditableCell.js';
import { PageHeader } from '../components/PageHeader.js';

export function UsersView({ currentUserId, onSelfUpdated }) {
  const { data, loading, error, reload } = useAsync(() => api.listUsers(), []);
  const [rows, applyRow] = useRowEdits(data?.items || [], data);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState(null);   // { email, password, reason }
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');

  // Los cargos se muestran agrupados; el backend sigue siendo el que decide
  // cuáles existen (`data.roles`).
  const roles = useMemo(() => {
    const allowed = new Set(data?.roles || []);
    return roleOptions()
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !allowed.size || allowed.has(item.value)),
      }))
      .filter((group) => group.items.length);
  }, [data?.roles]);

  const save = async (user, changes) => {
    const { item } = await api.updateUser(user.id, changes);
    applyRow(item);
    // Cambiar la propia cuenta cambia lo que muestra el resto de la app.
    if (user.id === currentUserId) onSelfUpdated?.();
  };

  const run = async (action, message) => {
    setFailure('');
    setNotice('');
    try {
      const result = await action();
      if (message) setNotice(message);
      return result;
    } catch (err) {
      setFailure(err.message);
      throw err;
    }
  };

  const resetPassword = (user) =>
    run(async () => {
      const { temporary_password } = await api.resetUserPassword(user.id);
      setSecret({ email: user.email, password: temporary_password, reason: 'reset' });
      reload();
    }).catch(() => {});

  const revokeSessions = (user) =>
    run(async () => {
      const { closed_sessions } = await api.revokeUserSessions(user.id);
      reload();
      setNotice(closed_sessions
        ? `Cerré ${closed_sessions} sesión${closed_sessions === 1 ? '' : 'es'} de ${user.email}.`
        : `${user.email} no tenía sesiones abiertas.`);
    }).catch(() => {});

  const remove = (user) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${user.email}? No se puede deshacer.`)) return;
    run(async () => {
      await api.deleteUser(user.id);
      reload();
    }, `Cuenta de ${user.email} eliminada.`).catch(() => {});
  };

  const columns = useMemo(() => [
    {
      key: 'email', header: 'Correo', width: 'minmax(185px, 1.5fr)',
      render: (user) => h(EditableCell, {
        value: user.email,
        display: h('span', { className: 'strong' }, user.email),
        onSave: (next) => save(user, { email: next }),
      }),
    },
    {
      key: 'name', header: 'Nombre', width: 'minmax(105px, 1fr)',
      render: (user) => h(EditableCell, {
        value: user.name || '',
        display: h('span', { className: 'muted' }, user.name || '—'),
        onSave: (next) => save(user, { name: next }),
      }),
    },
    {
      key: 'role', header: 'Rol', width: '140px',
      render: (user) => h(EditableCell, {
        value: user.role, type: 'select', options: roles,
        display: h(Badge, { tone: user.role === 'admin' ? 'success' : 'neutral' },
          roleLabel(user.role)),
        onSave: (next) => save(user, { role: next }),
      }),
    },
    {
      key: 'is_active', header: 'Estado', width: '110px',
      render: (user) => h(EditableCell, {
        value: user.is_active ? 'si' : 'no', type: 'select',
        options: [{ value: 'si', label: 'Activa' }, { value: 'no', label: 'Desactivada' }],
        display: h(Badge, { tone: user.is_active ? 'success' : 'danger' },
          user.is_active ? 'Activa' : 'Desactivada'),
        onSave: (next) => save(user, { is_active: next === 'si' }),
      }),
    },
    {
      key: 'must_change_password', header: 'Debe cambiar', width: '100px',
      render: (user) => h(EditableCell, {
        value: user.must_change_password ? 'si' : 'no', type: 'select',
        options: [{ value: 'no', label: 'No' }, { value: 'si', label: 'Sí, al entrar' }],
        display: h('span', { className: 'muted' },
          user.must_change_password ? 'Sí, al entrar' : 'No'),
        onSave: (next) => save(user, { must_change_password: next === 'si' }),
      }),
    },
    // De aquí en adelante lo escribe el sistema: se muestra, no se edita.
    {
      key: 'last_login_at', header: 'Último acceso', width: '108px',
      render: (user) => h(EditableCell, {
        readOnly: true,
        display: h('span', { className: 'muted' },
          user.last_login_at
            ? `${shortDate(user.last_login_at.slice(0, 10))} ${user.last_login_at.slice(11, 16)}`
            : 'nunca'),
      }),
    },
    {
      key: 'actions', header: '', width: '230px', align: 'right', actions: true,
      render: (user) => h('div', { className: 'users__actions' },
        h('button', {
          className: 'link', title: 'Generar una contraseña temporal nueva',
          onClick: () => resetPassword(user),
        }, 'Contraseña'),
        h('button', {
          className: 'link', onClick: () => revokeSessions(user),
          disabled: !user.open_sessions,
          title: user.open_sessions
            ? `Cerrar ${user.open_sessions} sesión(es) abiertas`
            : 'No tiene sesiones abiertas',
        }, user.open_sessions ? `Cerrar (${user.open_sessions})` : 'Cerrar'),
        user.id === currentUserId
          ? null
          : h('button', { className: 'link link--danger', onClick: () => remove(user) }, 'Eliminar')),
    },
  ], [roles, currentUserId]);

  return h('div', { className: 'page' },
    h(PageHeader, {
      title: 'Usuarios',
      subtitle: 'Quién entra al panel · todos ven y editan lo mismo; '
        + 'solo Administrador gestiona usuarios y accesos',
      actions: [
        h(Button, { key: 'reload', onClick: reload }, 'Actualizar'),
        h(Button, { key: 'new', variant: 'primary', onClick: () => setCreating(true) },
          'Crear usuario'),
      ],
    }),

    secret
      ? h(Card, { className: 'secret' },
          h('h3', null, secret.reason === 'reset'
            ? 'Contraseña nueva'
            : 'Cuenta creada'),
          h('p', { className: 'muted' },
            `Entréguele estos datos a ${secret.email}. La contraseña se muestra una sola vez y `
            + 'el sistema le va a pedir cambiarla al entrar.'),
          h('div', { className: 'secret__value' },
            h('code', null, secret.password),
            h(Button, {
              onClick: () => navigator.clipboard?.writeText(secret.password),
            }, 'Copiar')),
          h(Button, { onClick: () => setSecret(null) }, 'Listo'))
      : null,

    notice ? h('p', { className: 'form-notice' }, notice) : null,
    failure ? h('p', { className: 'form-error' }, failure) : null,
    error ? h('p', { className: 'form-error' }, error.message) : null,

    creating
      ? h(NewUserForm, {
          roles,
          onClose: () => setCreating(false),
          onCreated: (created, password) => {
            setCreating(false);
            if (password) setSecret({ email: created.email, password, reason: 'new' });
            reload();
          },
        })
      : null,

    h(DataTable, {
      columns,
      rows,
      rowKey: (user) => user.id,
      loading,
      minWidth: '1090px',
      empty: 'No hay usuarios.',
    }));
}

/** Inline form: an admin creates the account and hands over the password. */
function NewUserForm({ roles, onClose, onCreated }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('miembro');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    // The fields are the source of truth, as in the other forms.
    const fields = event.target.elements;
    const account = {
      email: (fields.email?.value ?? email).trim(),
      name: (fields.name?.value ?? name).trim(),
      role: fields.role?.value ?? role,
    };
    setError('');
    setBusy(true);
    try {
      const { item, temporary_password } = await api.createUser(account);
      onCreated(item, temporary_password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return h(Card, { className: 'users__form' },
    h('form', { onSubmit: submit },
      h('div', { className: 'users__form-row' },
        h('label', { className: 'field' },
          h('span', { className: 'field__label' }, 'Correo'),
          h('input', {
            className: 'input', name: 'email', type: 'email', value: email, required: true,
            placeholder: 'nombre@empresa.co',
            onInput: (e) => setEmail(e.target.value),
          })),
        h('label', { className: 'field' },
          h('span', { className: 'field__label' }, 'Nombre'),
          h('input', {
            className: 'input', name: 'name', value: name, placeholder: 'Opcional',
            onInput: (e) => setName(e.target.value),
          })),
        h('label', { className: 'field' },
          h('span', { className: 'field__label' }, 'Rol'),
          h('select', {
            className: 'input', name: 'role', value: role,
            onChange: (e) => setRole(e.target.value),
          }, roles.map((group) =>
            h('optgroup', { key: group.label, label: group.label },
              group.items.map((option) =>
                h('option', {
                  key: option.value, value: option.value,
                  selected: option.value === role,
                }, option.label))))))),
      error ? h('p', { className: 'form-error' }, error) : null,
      h('div', { className: 'users__form-actions' },
        h(Button, { onClick: onClose, disabled: busy }, 'Cancelar'),
        h(Button, { variant: 'primary', type: 'submit', disabled: busy },
          busy ? 'Creando…' : 'Crear y generar contraseña'))));
}
