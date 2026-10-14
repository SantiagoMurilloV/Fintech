/**
 * Configuración del panel.
 *
 * Cuatro bloques: de dónde vienen los datos (endpoint), con qué hoja de cálculo
 * se sincroniza, las integraciones que se conectan con un clic (QuickBooks) y
 * los interruptores que pausan cada dirección del sincronismo por separado.
 *
 * Los dos botones de «Probar» son el punto: llaman al endpoint y a la hoja y
 * muestran qué trae cada uno — campos, columnas y una muestra — porque el
 * mapeo con nuestras tablas se decide mirando datos reales, no adivinando.
 * Guardar es solo para administradores; el resto la ve en modo lectura.
 */
import { h, useEffect, useMemo, useState } from '../core/runtime.js';
import { api } from '../core/api.js';
import { QUICKBOOKS_AVAILABLE } from '../config.js';
import { navigate } from '../core/router.js';
import { useAsync } from '../hooks/useAsync.js';
import { Badge } from '../components/Badge.js';
import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { PageHeader } from '../components/PageHeader.js';

/**
 * Lo que trajo el navegador de vuelta de Intuit: el backend redirige a
 * `/?quickbooks=connected|cancelled|error&…#/settings`. Se lee una vez y se
 * limpia la URL para que recargar no repita el aviso.
 */
function takeOAuthOutcome() {
  const url = new URL(window.location.href);
  const outcome = url.searchParams.get('quickbooks');
  if (!outcome) return null;
  const detail = {
    outcome,
    company: url.searchParams.get('company') || '',
    reason: url.searchParams.get('reason') || '',
  };
  for (const key of ['quickbooks', 'company', 'reason']) url.searchParams.delete(key);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return detail;
}

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

    h(PlanCard, { isAdmin }),

    data
      ? SECTIONS.map((section) => [
          // Integraciones va entre las fuentes y la sincronización: es una
          // fuente más, pero se conecta con un clic en vez de con un token.
          section.id === 'sync'
            ? h(QuickBooksCard, {
                key: 'integrations', isAdmin, values, set, dirty,
                onSaved: reload,
              })
            : null,
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
              : null),
        ])
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

/** Campos de la tarjeta de QuickBooks; viajan por el mismo «Guardar» que el resto. */
const QUICKBOOKS_OPTIONS = [
  { key: 'quickbooks.enabled', label: 'Traer datos de QuickBooks en cada ciclo', kind: 'switch' },
  { key: 'quickbooks.sync_expenses', label: 'Gastos (Purchase y Bill)', kind: 'switch' },
  { key: 'quickbooks.sync_sales', label: 'Ventas (Invoice y SalesReceipt)', kind: 'switch' },
  {
    key: 'quickbooks.since', label: 'Traer transacciones desde', kind: 'text',
    placeholder: 'AAAA-MM-DD', hint: 'Vacío = desde el 1 de enero de este año. Solo aplica a la primera carga.',
  },
];

const QUICKBOOKS_CREDENTIALS = [
  {
    key: 'quickbooks.environment', label: 'Entorno', kind: 'select',
    options: [['sandbox', 'Sandbox (empresa de prueba de Intuit)'], ['production', 'Producción']],
    hint: 'Cada entorno tiene su propio par de llaves en developer.intuit.com.',
  },
  { key: 'quickbooks.client_id', label: 'Client ID', kind: 'text', placeholder: 'ABxyz…' },
  { key: 'quickbooks.client_secret', label: 'Client Secret', kind: 'secret', placeholder: 'Secret' },
];

/**
 * Logo oficial de Intuit QuickBooks, sin alterar: el PNG «preferred» de las
 * guías de marca de Intuit sobre fondo claro y el «reversed» sobre fondo
 * oscuro (el CSS muestra uno u otro según data-theme). Intuit pide no
 * modificar el logo y no abreviar la marca como «QB».
 */
function QuickBooksLogo() {
  return h('div', { className: 'integration__logo' },
    h('img', {
      className: 'integration__logo-img integration__logo-img--light',
      src: '/icons/quickbooks-logo.png', alt: 'Intuit QuickBooks', height: 30,
    }),
    h('img', {
      className: 'integration__logo-img integration__logo-img--dark',
      src: '/icons/quickbooks-logo-reversed.png', alt: '', 'aria-hidden': 'true', height: 30,
    }));
}

const QUICKBOOKS_STATE = {
  connected: ['success', 'Conectada'],
  needs_reconnect: ['warning', 'Requiere reconectar'],
  disconnected: ['neutral', 'No conectada'],
};

/**
 * Integraciones: por ahora, QuickBooks Online.
 *
 * La conexión es OAuth: «Conectar» lleva el navegador a Intuit, la persona
 * autoriza con su propia cuenta y vuelve aquí ya conectada. Las credenciales
 * de la app son de Mandioca, no del cliente, por eso viven plegadas abajo.
 */
/**
 * Plan de cuentas: las cajas donde se ordena la plata de la empresa y las
 * recetas de sus totales. Se parte de una plantilla (archivos en el backend,
 * app/plans/) y se ajusta en su propia pantalla.
 */
function PlanCard({ isAdmin }) {
  const plan = useAsync(() => api.getPlan(), []);
  const templates = useAsync(() => api.listPlanTemplates(), []);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);       // { tone, text }

  const items = templates.data?.items || [];
  const selected = chosen || items[0]?.id || '';
  const count = plan.data?.accounts.length || 0;

  const load = async () => {
    const template = items.find((item) => item.id === selected);
    if (!template) return;
    const replace = count > 0;
    if (replace && !window.confirm(
      `¿Reemplazar el plan actual (${count} cuentas) por «${template.name}»? `
      + 'Las cifras de las cuentas que no existan en la plantilla se borran.')) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.loadPlanTemplate(selected, replace);
      setNotice({ tone: 'ok', text: `Plan «${template.name}» cargado: ${result.accounts.length} cuentas.` });
      plan.reload();
    } catch (err) {
      setNotice({ tone: 'bad', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return h(Card, { className: 'settings__section' },
    h('div', { className: 'settings__head' },
      h('div', null,
        h('h2', { className: 'settings__title' }, 'Plan de cuentas'),
        h('p', { className: 'settings__hint' },
          'Las cajas donde la empresa ordena su plata (ventas, nómina, arriendo…) y cómo se '
          + 'calculan los totales. Con él se arma el estado de resultados de cada mes.')),
      h('div', { className: 'settings__actions' },
        count ? h(Button, { onClick: () => navigate('statement') }, 'Ver estado') : null,
        h(Button, { variant: count ? 'ghost' : 'subtle', onClick: () => navigate('plan') },
          isAdmin ? 'Editar plan' : 'Ver plan'))),

    plan.error ? h('p', { className: 'form-error' }, plan.error.message) : null,
    notice ? h('p', { className: notice.tone === 'ok' ? 'form-notice' : 'form-error' }, notice.text) : null,

    h('p', { className: 'settings__hint' },
      plan.loading && !plan.data
        ? 'Cargando…'
        : count
          ? `${count} cuentas · ${plan.data.inputs} se llenan con cifras · ${plan.data.totals} totales calculados.`
          : 'Todavía no hay plan. Elija una plantilla para empezar; después se ajusta en pantalla.'),

    isAdmin && items.length
      ? h('div', { className: 'settings__fields plan-template' },
          h('label', { className: 'field' },
            h('span', null, count ? 'Reemplazar por una plantilla' : 'Plantilla'),
            h('select', {
              className: 'input', value: selected,
              onChange: (event) => setChosen(event.target.value),
            }, items.map((item) => h('option', {
              key: item.id, value: item.id, selected: item.id === selected,
            }, `${item.name} · ${item.accounts} cuentas`))),
            h('small', { className: 'field__hint' },
              items.find((item) => item.id === selected)?.description || '')),
          h('div', { className: 'plan-template__action' },
            h(Button, { variant: count ? 'ghost' : 'primary', disabled: busy, onClick: load },
              busy ? 'Cargando…' : 'Cargar plantilla')))
      : null);
}

function QuickBooksCard(props) {
  // Mientras la app de Mandioca en Intuit no exista, la tarjeta solo anuncia.
  if (!QUICKBOOKS_AVAILABLE) return h(QuickBooksPreview);
  return h(QuickBooksLive, props);
}

function QuickBooksPreview() {
  return h(Card, { className: 'settings__section' },
    h('div', { className: 'settings__head' },
      h('div', null,
        h('h2', { className: 'settings__title' }, 'Integraciones'),
        h('p', { className: 'settings__hint' },
          'Sistemas externos que se conectarán con un clic. Lo que traigan entrará '
          + 'como órdenes y gastos, igual que el endpoint o la hoja.'))),
    h('div', { className: 'integration integration--preview' },
      h('div', { className: 'integration__row' },
        h(QuickBooksLogo),
        h('div', { className: 'integration__body' },
          h('div', { className: 'integration__name' },
            h('span', null, 'QuickBooks Online'),
            h(Badge, { tone: 'neutral' }, 'Próximamente')),
          h('p', { className: 'settings__hint' },
            'Traerá los gastos, facturas de proveedor, facturas de venta y recibos de su '
            + 'contabilidad. Se autorizará en la pantalla de Intuit con la cuenta de '
            + 'QuickBooks, sin pegar credenciales.')))));
}

function QuickBooksLive({ isAdmin, values, set, dirty, onSaved }) {
  const { data: status, loading, error, reload } = useAsync(() => api.quickbooksStatus(), []);
  const [busy, setBusy] = useState('');          // 'connect' | 'sync' | 'disconnect'
  const [notice, setNotice] = useState(null);    // { tone, text }
  const [pull, setPull] = useState(null);        // { running, report, problem }

  // Aviso de la vuelta de Intuit, una sola vez.
  useEffect(() => {
    const outcome = takeOAuthOutcome();
    if (!outcome) return;
    if (outcome.outcome === 'connected') {
      setNotice({ tone: 'ok', text: `QuickBooks quedó conectado${outcome.company ? ` a «${outcome.company}»` : ''}.` });
    } else if (outcome.outcome === 'cancelled') {
      setNotice({ tone: 'bad', text: 'La autorización se canceló en Intuit. No se conectó nada.' });
    } else {
      setNotice({ tone: 'bad', text: `No se pudo conectar: ${outcome.reason || 'error desconocido'}.` });
    }
  }, []);

  const connect = async () => {
    if (dirty) {
      setNotice({ tone: 'bad', text: 'Guarde los cambios pendientes antes de conectar.' });
      return;
    }
    setBusy('connect');
    setNotice(null);
    try {
      const { url } = await api.quickbooksConnect();
      window.location.assign(url);   // Intuit devuelve el navegador a esta pantalla
    } catch (err) {
      setNotice({ tone: 'bad', text: err.message });
      setBusy('');
    }
  };

  const sync = async () => {
    setBusy('sync');
    setPull({ running: true });
    try {
      const { report } = await api.quickbooksSync();
      setPull({ report });
      reload();
      onSaved?.();
    } catch (err) {
      setPull({ problem: err.message });
      reload();
    } finally {
      setBusy('');
    }
  };

  const disconnect = async () => {
    const question = '¿Desconectar QuickBooks? Se revoca el acceso en Intuit. Las órdenes y '
      + 'gastos ya importados quedan en el panel.';
    if (!window.confirm(question)) return;
    setBusy('disconnect');
    try {
      await api.quickbooksDisconnect();
      setNotice({ tone: 'ok', text: 'QuickBooks quedó desconectado.' });
      setPull(null);
      reload();
    } catch (err) {
      setNotice({ tone: 'bad', text: err.message });
    } finally {
      setBusy('');
    }
  };

  const state = status?.status || 'disconnected';
  const [tone, label] = QUICKBOOKS_STATE[state] || QUICKBOOKS_STATE.disconnected;
  const connected = state === 'connected';
  // Desde los settings y no desde el estado: así «Conectar» se habilita apenas
  // se guardan las credenciales, sin esperar otra carga de la tarjeta.
  const configured = Boolean(String(values['quickbooks.client_id'] || '').trim())
    && Boolean(values['quickbooks.client_secret.configured'] || values['quickbooks.client_secret']);
  const canConnect = isAdmin && configured;

  return h(Card, { className: 'settings__section' },
    h('div', { className: 'settings__head' },
      h('div', null,
        h('h2', { className: 'settings__title' }, 'Integraciones'),
        h('p', { className: 'settings__hint' },
          'Sistemas externos que se conectan con un clic. Lo que traen entra como '
          + 'órdenes y gastos, igual que el endpoint o la hoja.'))),

    error ? h('p', { className: 'form-error' }, error.message) : null,
    notice
      ? h('p', { className: notice.tone === 'ok' ? 'form-notice' : 'form-error' }, notice.text)
      : null,

    h('div', { className: 'integration' },
      h('div', { className: 'integration__row' },
        h(QuickBooksLogo),
        h('div', { className: 'integration__body' },
          h('div', { className: 'integration__name' },
            h('span', null, 'QuickBooks Online'),
            loading && !status ? null : h(Badge, { tone }, label)),
          h('p', { className: 'settings__hint' },
            connected
              ? `Conectada a «${status.company_name || status.realm_id}»`
                + (status.connected_environment === 'sandbox' ? ' · sandbox' : '')
                + (status.home_currency ? ` · libros en ${status.home_currency}` : '')
                + (status.connected_at ? ` · desde ${String(status.connected_at).slice(0, 10)}` : '')
                + (status.last_sync_at
                  ? ` · última sincronización ${String(status.last_sync_at).replace('T', ' ')}`
                  : ' · todavía sin sincronizar')
              : state === 'needs_reconnect'
                ? `La conexión con «${status.company_name || status.realm_id}» dejó de funcionar`
                  + (status.last_error ? `: ${status.last_error}` : '.')
                  + ' Vuelva a autorizar para seguir trayendo datos.'
                : 'Trae los gastos, facturas de proveedor, facturas de venta y recibos de su '
                  + 'contabilidad. Se autoriza en la pantalla de Intuit con la cuenta de QuickBooks.'),
          connected && status.last_error
            ? h('p', { className: 'probe__bad' }, status.last_error)
            : null),
        h('div', { className: 'integration__actions' },
          isAdmin && connected
            ? h(Button, { onClick: sync, disabled: Boolean(busy) },
                busy === 'sync' ? 'Sincronizando…' : 'Sincronizar ahora')
            : null,
          isAdmin && (connected || state === 'needs_reconnect')
            ? h('button', {
                className: 'btn btn--danger', disabled: Boolean(busy), onClick: disconnect,
              }, busy === 'disconnect' ? 'Desconectando…' : 'Desconectar')
            : null,
          isAdmin && !connected
            ? h(Button, {
                variant: 'primary', onClick: connect,
                disabled: !canConnect || Boolean(busy),
                title: canConnect ? undefined : 'Primero cargue el Client ID y el Client Secret de la app.',
              }, busy === 'connect' ? 'Abriendo Intuit…' : state === 'needs_reconnect' ? 'Reconectar' : 'Conectar')
            : null)),

      isAdmin
        ? h('div', { className: 'settings__fields integration__options' },
            QUICKBOOKS_OPTIONS.map((field) =>
              h(SettingField, {
                key: field.key, field,
                value: values[field.key],
                configured: values[`${field.key}.configured`],
                disabled: !isAdmin,
                onChange: (next) => set(field.key, next),
              })))
        : null,

      // Credenciales de la app de Mandioca en Intuit. Plegadas: se cargan una
      // vez (o por variables de entorno) y no se vuelven a tocar.
      isAdmin
        ? h('details', { className: 'integration__advanced', open: !configured },
            h('summary', null,
              configured
                ? 'Credenciales de la app (avanzado)'
                : 'Credenciales de la app · faltan para poder conectar'),
            h('p', { className: 'settings__hint integration__advanced-hint' },
              'Son las llaves de la app de Mandioca en developer.intuit.com, no las del '
              + 'cliente. En esa app, la Redirect URI debe ser exactamente:'),
            h('pre', { className: 'probe__code integration__redirect' }, status?.redirect_uri || '…'),
            h('div', { className: 'settings__fields' },
              QUICKBOOKS_CREDENTIALS.map((field) =>
                h(SettingField, {
                  key: field.key, field,
                  value: values[field.key],
                  configured: values[`${field.key}.configured`],
                  disabled: !isAdmin,
                  onChange: (next) => set(field.key, next),
                }))))
        : null,

      h(PullReport, { pull, stored: status?.last_pull })));
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
      `Última sincronización: ${String(report.ran_at || '').replace('T', ' ')}`
      // QuickBooks dice qué ventana cubrió: todo desde una fecha, o solo cambios.
      + (report.window ? ` · ${report.window}` : '')),
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
        // Criteria the sync applied on purpose: worth knowing, nothing to fix.
        info.notes?.length
          ? h('div', { className: 'probe__group' },
              h('p', { className: 'probe__caption' }, 'Criterios aplicados'),
              info.notes.map((note) => h('p', { key: note, className: 'probe__note' }, note)))
          : null,
        // What needs a person: a substitution, a gap in the totals, an unknown state.
        info.problems?.length
          ? h('div', { className: 'probe__group' },
              h('p', { className: 'probe__caption probe__caption--bad' }, 'Requiere atención'),
              info.problems.map((problem) => h('p', { key: problem, className: 'probe__bad' }, problem)))
          : null)));
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
