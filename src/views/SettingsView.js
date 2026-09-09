/**
 * Configuración del panel.
 *
 * Tres bloques: de dónde vienen los datos (endpoint), con qué hoja de cálculo
 * se sincroniza, y los interruptores que pausan cada dirección del sincronismo
 * por separado.
 *
 * Los dos botones de «Probar» son el punto: llaman al endpoint y a la hoja y
 * muestran qué trae cada uno — campos, columnas y una muestra — porque el
 * mapeo con nuestras tablas se decide mirando datos reales, no adivinando.
 * Guardar es solo para administradores; el resto la ve en modo lectura.
 */
import { h, useEffect, useMemo, useState } from '../core/runtime.js';
import { api } from '../core/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';

/** Campos de cada bloque. `secret` no vuelve del servidor: se escribe o se deja. */
const SECTIONS = [
  {
    id: 'api',
    title: 'Datos desde el endpoint',
    hint: 'De dónde salen las órdenes y los gastos cuando la API es la fuente. '
      + 'Todavía no mapeamos campos: primero mire qué trae con «Probar».',
    fields: [
      { key: 'api.enabled', label: 'Usar el endpoint', kind: 'switch' },
      { key: 'api.base_url', label: 'URL base', kind: 'text', placeholder: 'https://api.empresa.com' },
      { key: 'api.token', label: 'Token o API key', kind: 'secret', placeholder: 'Token' },
      {
        key: 'api.auth_scheme', label: 'Cómo se envía el token', kind: 'select',
        options: [['bearer', 'Authorization: Bearer <token>'], ['api-key', 'Authorization: Api-Key <key>']],
        hint: 'Api-Key es la convención de las API con clave tipo DRF (p. ej. Mandioca/AUXO).',
      },
      {
        key: 'api.orders_path', label: 'Rutas de órdenes', kind: 'text',
        placeholder: 'deposit/, order-payin/, order-payout/',
        hint: 'Varias rutas separadas por coma: cada una se importa como órdenes.',
      },
      {
        key: 'api.expenses_path', label: 'Rutas de gastos', kind: 'text', placeholder: '/expenses',
        hint: 'También acepta varias rutas separadas por coma.',
      },
      {
        key: 'api.default_currency', label: 'Moneda si el feed no trae una', kind: 'text',
        placeholder: 'COP', hint: 'USD, COP, MXN, USDT o USDC',
      },
      {
        key: 'intake.orders_override', label: 'Mapeo manual de órdenes (JSON)', kind: 'text',
        placeholder: '{"amount": "total", "customer": "client_name"}',
        hint: 'Vacío = decide el agente de ingesta. Si lo llena, su mapeo manda.',
      },
      {
        key: 'intake.expenses_override', label: 'Mapeo manual de gastos (JSON)', kind: 'text',
        placeholder: '{"amount": "value", "description": "concept"}',
        hint: 'Vacío = decide el agente de ingesta.',
      },
    ],
    probe: 'api',
  },
  {
    id: 'sheets',
    title: 'Hoja de cálculo (Google Sheets)',
    hint: 'La hoja con la que trabaja el equipo. Pegue el JSON de una cuenta de '
      + 'servicio y compártale la hoja a ese correo como editor.',
    fields: [
      { key: 'sheets.enabled', label: 'Usar la hoja', kind: 'switch' },
      {
        key: 'sheets.spreadsheet_id', label: 'ID de la hoja', kind: 'text',
        placeholder: '1AbC…', hint: 'Es la parte larga de la URL, entre /d/ y /edit',
      },
      {
        key: 'sheets.credentials', label: 'Credenciales de la cuenta de servicio',
        kind: 'secret', area: true, placeholder: '{ "type": "service_account", … }',
      },
      { key: 'sheets.orders_tab', label: 'Pestaña de órdenes', kind: 'text' },
      { key: 'sheets.expenses_tab', label: 'Pestaña de gastos', kind: 'text' },
    ],
    probe: 'sheets',
  },
  {
    id: 'sync',
    title: 'Sincronización',
    hint: 'Las dos direcciones se pausan por separado. El botón trae los datos '
      + 'ya mismo; el bucle de fondo corre solo si la fuente está activada y '
      + 'la dirección no está en pausa.',
    fields: [
      { key: 'sync.pull_enabled', label: 'Traer datos de la fuente al panel', kind: 'switch' },
      { key: 'sync.push_enabled', label: 'Escribir del panel a la fuente', kind: 'switch' },
      {
        key: 'sync.interval_seconds', label: 'Revisar la fuente cada (segundos)',
        kind: 'number',
      },
    ],
  },
];

export function SettingsView({ isAdmin, theme }) {
  const { data, loading, error, reload } = useAsync(() => api.getSettings(), []);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [failure, setFailure] = useState('');
  const [probe, setProbe] = useState(null);      // { section, running, result, problem }
  const [pull, setPull] = useState(null);        // { running, report, problem }

  // Lo guardado es la base; el borrador solo lleva lo que el usuario tocó.
  const values = useMemo(() => ({ ...(data?.values || {}), ...draft }), [data, draft]);
  const dirty = Object.keys(draft).length > 0;

  useEffect(() => { setDraft({}); }, [data]);

  const set = (key, value) => {
    setSaved('');
    setFailure('');
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setFailure('');
    try {
      await api.saveSettings(draft);
      setSaved('Configuración guardada.');
      reload();
    } catch (err) {
      setFailure(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runPull = async () => {
    setPull({ running: true });
    try {
      const { report } = await api.syncPull();
      setPull({ report });
    } catch (err) {
      setPull({ problem: err.message });
    }
  };

  const [wiping, setWiping] = useState(false);

  const wipe = async (scope) => {
    const question = scope === 'all'
      ? '¿Borrar TODAS las órdenes, gastos y columnas del panel? Los usuarios y '
        + 'la configuración no se tocan. La fuente externa tampoco. No se puede deshacer.'
      : '¿Borrar los datos importados por sincronización? Lo registrado a mano '
        + 'queda; la fuente externa no se toca. No se puede deshacer.';
    if (!window.confirm(question)) return;
    setWiping(true);
    setFailure('');
    try {
      const { removed } = await api.clearData(scope);
      setSaved(`Borrado: ${removed.orders} órdenes, ${removed.expenses} gastos, `
        + `${removed.columns} columnas dinámicas.`);
      setPull(null);
      reload();
    } catch (err) {
      setFailure(err.message);
    } finally {
      setWiping(false);
    }
  };

  const runProbe = async (section) => {
    setProbe({ section, running: true });
    try {
      const result = section === 'api' ? await api.probeApi() : await api.probeSheets();
      setProbe({ section, result });
    } catch (err) {
      setProbe({ section, problem: err.message });
    }
  };

  return h('div', { className: 'page' },
    h(PageHeader, {
      title: 'Configuración',
      subtitle: isAdmin
        ? 'Fuentes de datos y sincronización'
        : 'Fuentes de datos y sincronización · solo un administrador puede cambiarlas',
      actions: [
        h(Button, { key: 'reload', onClick: reload }, 'Recargar'),
        isAdmin
          ? h(Button, {
              key: 'save', variant: 'primary', disabled: !dirty || saving, onClick: save,
            }, saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios')
          : null,
      ].filter(Boolean),
    }),

    saved ? h('p', { className: 'form-notice' }, saved) : null,
    failure ? h('p', { className: 'form-error' }, failure) : null,
    error ? h('p', { className: 'form-error' }, error.message) : null,
    loading && !data ? h('p', { className: 'muted' }, 'Cargando configuración…') : null,

    // La apariencia es preferencia de este navegador (localStorage), no del
    // servidor: cambia al instante y no pasa por «Guardar» ni exige admin.
    h(Card, { className: 'settings__section' },
      h('div', { className: 'settings__head' },
        h('div', null,
          h('h2', { className: 'settings__title' }, 'Apariencia'),
          h('p', { className: 'settings__hint' },
            'Cómo se ve el panel en este dispositivo. Se aplica al momento.'))),
      h('div', { className: 'settings__theme' },
        [['light', 'Claro', '☀'], ['dark', 'Oscuro', '☾']].map(([value, label, icon]) =>
          h('button', {
            key: value,
            className: `theme-option ${theme?.theme === value ? 'is-active' : ''}`.trim(),
            'aria-pressed': theme?.theme === value ? 'true' : 'false',
            onClick: () => theme?.theme !== value && theme?.toggle(),
          },
            h('span', { className: 'theme-option__icon', 'aria-hidden': 'true' }, icon),
            label)))),

    data
      ? SECTIONS.map((section) =>
          h(Card, { key: section.id, className: 'settings__section' },
            h('div', { className: 'settings__head' },
              h('div', null,
                h('h2', { className: 'settings__title' }, section.title),
                h('p', { className: 'settings__hint' }, section.hint)),
              section.probe && isAdmin
                ? h(Button, {
                    onClick: () => runProbe(section.probe),
                    disabled: probe?.section === section.probe && probe?.running,
                  }, probe?.section === section.probe && probe?.running ? 'Probando…' : 'Probar')
                : null,
              section.id === 'sync' && isAdmin
                ? h(Button, {
                    variant: 'primary',
                    onClick: runPull,
                    disabled: pull?.running,
                  }, pull?.running ? 'Sincronizando…' : 'Sincronizar ahora')
                : null),

            h('div', { className: 'settings__fields' },
              section.fields.map((field) =>
                h(SettingField, {
                  key: field.key,
                  field,
                  value: values[field.key],
                  configured: values[`${field.key}.configured`],
                  disabled: !isAdmin,
                  onChange: (next) => set(field.key, next),
                }))),

            // `section.probe` primero: la sección de sincronización no tiene
            // prueba, y sin esta guarda `undefined === undefined` pasaba.
            section.probe && probe?.section === section.probe && !probe.running
              ? h(ProbeResult, { probe })
              : null,
            section.id === 'sync'
              ? h(PullReport, {
                  pull,
                  stored: data?.last_pull,
                })
              : null))
      : null,

    // Al final a propósito: lo destructivo no convive con lo cotidiano.
    isAdmin && data
      ? h(Card, { className: 'settings__section settings__danger' },
          h('div', { className: 'settings__head' },
            h('div', null,
              h('h2', { className: 'settings__title' }, 'Zona de peligro'),
              h('p', { className: 'settings__hint' },
                'Borra datos de ESTE panel. La fuente externa — la API o la hoja — '
                + 'no se toca nunca desde aquí. No se puede deshacer.'))),
          h('div', { className: 'settings__danger-actions' },
            h('div', { className: 'settings__danger-row' },
              h('div', null,
                h('p', { className: 'settings__danger-label' }, 'Borrar datos importados'),
                h('p', { className: 'settings__hint' },
                  'Solo lo que entró por sincronización, con sus columnas dinámicas y '
                  + 'decisiones de mapeo. Lo registrado a mano queda.')),
              h('button', {
                className: 'btn btn--danger', disabled: wiping,
                onClick: () => wipe('imported'),
              }, wiping ? 'Borrando…' : 'Borrar importados')),
            h('div', { className: 'settings__danger-row' },
              h('div', null,
                h('p', { className: 'settings__danger-label' }, 'Borrar todas las órdenes y gastos'),
                h('p', { className: 'settings__hint' },
                  'Vacía las dos tablas y todas las columnas dinámicas. Usuarios, '
                  + 'sesiones, conversaciones y configuración quedan intactos.')),
              h('button', {
                className: 'btn btn--danger', disabled: wiping,
                onClick: () => wipe('all'),
              }, wiping ? 'Borrando…' : 'Borrar todo'))))
      : null);
}

function SettingField({ field, value, configured, disabled, onChange }) {
  if (field.kind === 'switch') {
    return h('label', { className: 'settings__switch' },
      h('input', {
        type: 'checkbox', checked: Boolean(value), disabled,
        onChange: (event) => onChange(event.target.checked),
      }),
      h('span', null, field.label));
  }

  const common = {
    className: 'input', disabled,
    onInput: (event) => onChange(event.target.value),
  };

  if (field.kind === 'select') {
    const current = value ?? field.options[0][0];
    return h('label', { className: 'field' },
      h('span', { className: 'field__label' }, field.label),
      h('select', {
        className: 'input', disabled, value: current,
        onChange: (event) => onChange(event.target.value),
      },
        // `selected` marca la opción al crear el nodo: los props del select se
        // aplican antes de que existan sus options, así que `value` solo no basta.
        field.options.map(([optionValue, optionLabel]) =>
          h('option', { key: optionValue, value: optionValue, selected: optionValue === current },
            optionLabel))),
      field.hint ? h('span', { className: 'field__hint' }, field.hint) : null);
  }

  return h('label', { className: 'field' },
    h('span', { className: 'field__label' }, field.label),
    field.kind === 'secret'
      ? h(field.area ? 'textarea' : 'input', {
          ...common,
          rows: field.area ? 6 : undefined,
          // Nunca llega del servidor: vacío significa «dejalo como está».
          placeholder: configured ? 'Guardado · escriba para reemplazarlo' : field.placeholder,
          value: value && typeof value === 'string' ? value : '',
        })
      : h('input', {
          ...common,
          type: field.kind === 'number' ? 'number' : 'text',
          placeholder: field.placeholder,
          value: value ?? '',
        }),
    field.hint ? h('span', { className: 'field__hint' }, field.hint) : null,
    field.kind === 'secret' && configured
      ? h('span', { className: 'field__hint' }, 'Ya hay un valor guardado.')
      : null);
}

/** Resultado de la última sincronización: qué entró, qué se omitió y por qué. */
function PullReport({ pull, stored }) {
  if (pull?.running) return null;
  if (pull?.problem) {
    return h('div', { className: 'probe probe--bad' }, h('p', null, pull.problem));
  }
  const report = pull?.report || stored;
  if (!report) return null;

  return h('div', { className: 'probe' },
    h('p', { className: 'probe__title' },
      `Última sincronización: ${String(report.ran_at || '').replace('T', ' ')}`),
    Object.entries(report.entities || {}).map(([entity, info]) =>
      h('div', { key: entity, className: 'probe__block' },
        h('p', { className: 'probe__meta' },
          `${entity.startsWith('orders') ? 'Órdenes' : 'Gastos'} ← ${info.path} · `
          + `recibidos ${info.received}${info.pages > 1 ? ` en ${info.pages} páginas` : ''} · `
          + `nuevos ${info.imported} · `
          + `actualizados ${info.updated} · omitidos ${info.skipped}`),
        info.mapping && Object.keys(info.mapping).length
          ? h('pre', { className: 'probe__code' },
              'mapeo: ' + Object.entries(info.mapping)
                .map(([ours, theirs]) => `${ours} ← ${theirs}`).join(' · ')
              + (info.extra_columns?.length
                ? `\ncolumnas dinámicas: ${info.extra_columns.join(' | ')}`
                : ''))
          : null,
        (info.problems || []).map((problem) =>
          h('p', { key: problem, className: 'probe__bad' }, problem)))));
}

/** Lo que devolvió la prueba, en crudo pero legible. */
function ProbeResult({ probe }) {
  if (probe.problem) {
    return h('div', { className: 'probe probe--bad' },
      h('p', null, probe.problem));
  }

  const result = probe.result || {};
  if (probe.section === 'sheets') {
    const entities = Object.entries(result.entities || {});
    return h('div', { className: 'probe' },
      h('p', { className: 'probe__title' },
        `Hoja «${result.title}» · cuenta ${result.service_account}`),
      h('p', { className: 'probe__meta' },
        `Pestañas: ${(result.tabs_available || []).join(', ') || '—'}`),
      entities.map(([entity, info]) =>
        h('div', { key: entity, className: 'probe__block' },
          h('p', { className: 'probe__meta' },
            `${entity} → pestaña «${info.tab}»`,
            info.found ? ` · ${info.preview_rows} filas leídas` : ' · no existe'),
          info.problem ? h('p', { className: 'probe__bad' }, info.problem) : null,
          info.columns?.length
            ? h('pre', { className: 'probe__code' },
                `columnas: ${info.columns.join(' | ')}\n\n`
                + (info.sample || []).map((row) => row.join(' | ')).join('\n'))
            : null)));
  }

  const paths = Object.entries(result.paths || {});
  return h('div', { className: 'probe' },
    h('p', { className: 'probe__title' }, `Endpoint ${result.base_url}`),
    paths.map(([name, info]) =>
      h('div', { key: name, className: 'probe__block' },
        h('p', { className: 'probe__meta' },
          `${name} → ${info.path} · ${info.ok ? 'OK' : 'falló'}`,
          info.status_code ? ` ${info.status_code}` : '',
          info.ms ? ` · ${info.ms} ms` : ''),
        info.problem ? h('p', { className: 'probe__bad' }, info.problem) : null,
        h('pre', { className: 'probe__code' },
          [
            info.kind ? `forma: ${info.kind}${info.wrapper ? ` dentro de «${info.wrapper}»` : ''}` : null,
            info.count != null ? `registros: ${info.count}` : null,
            info.fields?.length ? `campos: ${info.fields.join(' | ')}` : null,
            info.sample ? `\n${JSON.stringify(info.sample, null, 2).slice(0, 900)}` : null,
            info.preview ? `\n${info.preview}` : null,
          ].filter(Boolean).join('\n')))));
}
