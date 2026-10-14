/**
 * Estado de resultados.
 *
 * El backend arma el estado con el plan de cuentas de la empresa: llena las
 * cuentas de entrada con las cifras del mes, resuelve las fórmulas de los
 * totales y agrega el análisis vertical (cada línea como % de otra) y el
 * horizontal (contra otro mes). Esta vista solo pinta números crudos con
 * lib/format.js: si la empresa cambia su plan, el estado cambia con él.
 *
 * Debajo, las cifras de cada mes se corrigen en el mismo lugar donde se leen,
 * como en Órdenes y Gastos: clic, escribir, salir del campo.
 */
import { h, useState } from '../core/runtime.js';
import { api, download } from '../core/api.js';
import { navigate } from '../core/router.js';
import { useAsync } from '../hooks/useAsync.js';
import { delta, figure, monthName, periodName, usdCompact } from '../lib/format.js';
import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { EditableCell } from '../components/EditableCell.js';
import { KpiCard } from '../components/KpiCard.js';
import { PageHeader } from '../components/PageHeader.js';

const COMPARE_OPTIONS = [
  ['prev', 'Mes anterior'],
  ['year', 'Mismo mes del año anterior'],
  ['none', 'Sin comparar'],
];

/** Meses visibles en la grilla de cifras, terminando en el mes elegido. */
const GRID_MONTHS = 6;

/** "2026-05" movido n meses. */
function shift(period, months) {
  const [year, month] = period.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function StatementView({ refreshKey, onOpenModal, isAdmin }) {
  const [period, setPeriod] = useState('');           // '' = último mes con cifras
  const [compare, setCompare] = useState('prev');
  const [edits, setEdits] = useState(0);              // una cifra cambió: recalcular
  const { data, loading, error } = useAsync(
    () => api.getStatement(period, compare), [period, compare, refreshKey, edits]);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);

  const noPlan = error && /plan de cuentas/i.test(error.message);

  const savePdf = async () => {
    setSaving(true);
    setNotice('');
    setFailure('');
    try {
      const report = await api.saveStatementReport(data.period, compare);
      setNotice(`«${report.title}» quedó guardado en Reportes.`);
    } catch (err) {
      setFailure(err.message);
    } finally {
      setSaving(false);
    }
  };

  const shownPeriod = data?.period || period;

  return h('div', { className: 'page page--wide' },
    h(PageHeader, {
      title: 'Estado de resultados',
      subtitle: data
        ? `${periodName(data.period)}${data.compare ? ` · comparado con ${periodName(data.compare)}` : ''}`
        : 'Lo que entró, lo que costó y lo que quedó, según el plan de cuentas de la empresa',
      actions: noPlan ? null : [
        h(Button, {
          key: 'import', variant: 'primary',
          onClick: () => onOpenModal('statement-import'),
        }, 'Cargar cifras'),
        h(Button, {
          key: 'template',
          onClick: () => download(
            `/api/plan/values/template.xlsx?last=${shownPeriod || ''}`,
            'cifras_plan_de_cuentas.xlsx').catch((err) => setFailure(err.message)),
        }, 'Plantilla Excel'),
        h(Button, {
          key: 'csv', disabled: !data?.has_data,
          onClick: () => download(
            `/api/statement/export.csv?period=${data.period}&compare=${compare}`,
            `estado_resultados_${data.period}.csv`).catch((err) => setFailure(err.message)),
        }, 'Exportar CSV'),
        h(Button, {
          key: 'pdf', disabled: !data?.has_data || saving, onClick: savePdf,
        }, saving ? 'Guardando…' : 'Guardar PDF'),
      ],
    }),

    notice ? h('p', { className: 'form-notice' }, notice) : null,
    failure ? h('p', { className: 'form-error' }, failure) : null,

    noPlan
      ? h(Card, { className: 'statement-empty' },
          h('h2', { className: 'settings__title' }, 'Primero, el plan de cuentas'),
          h('p', { className: 'settings__hint' },
            'El plan dice en qué cajas se ordena la plata de la empresa (ventas, nómina, '
            + 'arriendo…) y cómo se calculan los totales. Con él, este estado se arma solo.'),
          isAdmin
            ? h(Button, { variant: 'primary', onClick: () => navigate('settings') },
                'Ir a Configuración')
            : h('p', { className: 'muted' }, 'Pídale a un administrador que lo cargue.'))
      : null,

    error && !noPlan ? h('p', { className: 'form-error' }, error.message) : null,
    loading && !data ? h('p', { className: 'muted' }, 'Armando el estado…') : null,

    data
      ? [
          h('div', { key: 'controls', className: 'statement-controls' },
            h('label', { className: 'field' },
              h('span', null, 'Mes'),
              h('input', {
                className: 'input', type: 'month', value: data.period,
                onChange: (event) => event.target.value && setPeriod(event.target.value),
              })),
            data.periods.length
              ? h('label', { className: 'field' },
                  h('span', null, 'Meses con cifras'),
                  h('select', {
                    className: 'input', value: data.period,
                    onChange: (event) => setPeriod(event.target.value),
                  },
                    (data.periods.includes(data.period) ? data.periods : [data.period, ...data.periods])
                      .map((value) => h('option', {
                        key: value, value, selected: value === data.period,
                      }, periodName(value)))))
              : null,
            h('label', { className: 'field' },
              h('span', null, 'Comparar con'),
              h('select', {
                className: 'input', value: compare,
                onChange: (event) => setCompare(event.target.value),
              }, COMPARE_OPTIONS.map(([value, label]) =>
                h('option', { key: value, value, selected: value === compare }, label))))),

          data.has_data
            ? h(Headline, { key: 'kpis', data })
            : h('p', { key: 'empty', className: 'form-notice form-notice--warning' },
                `No hay cifras cargadas para ${periodName(data.period)}. `
                + 'Use «Cargar cifras» para subir el historial o escríbalas en la tabla de abajo.'),

          data.has_data ? h(StatementTable, { key: 'table', data }) : null,

          data.missing.length && data.has_data
            ? h('p', { key: 'missing', className: 'form-notice form-notice--warning' },
                `Sin cifra en ${periodName(data.period)}: ${data.missing.join(', ')}. `
                + 'Cuentan como cero; las líneas que dependen de ellas llevan *.')
            : null,

          h(ValuesGrid, {
            key: 'grid', last: data.period, refreshKey: `${refreshKey}-${edits}`,
            onChanged: () => setEdits((n) => n + 1),
          }),
        ]
      : null);
}

/** Las cuentas marcadas como titulares del plan, en tarjetas. */
function Headline({ data }) {
  const lines = data.rows.filter((line) => line.headline).slice(0, 4);
  if (!lines.length) return null;
  return h('div', { className: 'kpi-row' }, lines.map((line) => h(KpiCard, {
    key: line.key,
    label: line.name,
    value: line.unit === 'usd' && line.value != null ? usdCompact(line.value) : figure(line.value, line.unit),
    delta: line.variation_pct != null ? delta(line.variation_pct) : null,
    caption: data.compare ? `vs ${monthName(data.compare)}` : '',
    positive: line.tone !== 'danger',
  })));
}

function StatementTable({ data }) {
  const comparing = Boolean(data.compare);
  const template = comparing
    ? 'minmax(220px, 2.4fr) repeat(5, minmax(104px, 1fr))'
    : 'minmax(220px, 2.4fr) repeat(2, minmax(104px, 1fr))';
  const style = { gridTemplateColumns: template, minWidth: comparing ? '860px' : '520px' };

  return h(Card, { className: 'table statement' },
    h('div', { className: 'table__head', style },
      h('div', null, 'Cuenta'),
      h('div', { className: 'is-right' }, periodName(data.period)),
      h('div', { className: 'is-right' }, '% vertical'),
      comparing ? h('div', { className: 'is-right' }, periodName(data.compare)) : null,
      comparing ? h('div', { className: 'is-right' }, 'Variación') : null,
      comparing ? h('div', { className: 'is-right' }, 'Var. %') : null),

    data.rows.map((line) => {
      const classes = ['table__row', 'statement__row',
        `statement__row--${line.kind}`, line.level === 0 ? 'is-root' : ''].filter(Boolean).join(' ');
      const name = h('div', {
        className: 'statement__name',
        style: { paddingLeft: `${line.level * 18}px` },
        title: line.definition || '',
      }, line.name,
        line.status === 'partial'
          ? h('span', { className: 'statement__flag', title: 'Calculada con cifras faltantes' }, ' *')
          : null);
      if (line.kind === 'group') {
        return h('div', { key: line.key, className: classes, style }, name);
      }
      const tone = line.tone === 'success' ? 'is-good' : line.tone === 'danger' ? 'is-bad' : '';
      return h('div', { key: line.key, className: classes, style },
        name,
        h('div', { className: 'is-right' }, figure(line.value, line.unit)),
        h('div', { className: 'is-right statement__share' },
          line.vertical_pct != null ? figure(line.vertical_pct, 'pct') : ''),
        comparing ? h('div', { className: 'is-right statement__previous' },
          figure(line.previous, line.unit)) : null,
        comparing ? h('div', { className: `is-right ${tone}` },
          line.variation != null ? figure(line.variation, line.unit, { signed: true }) : '—') : null,
        comparing ? h('div', { className: `is-right ${tone}` },
          line.variation_pct != null ? delta(line.variation_pct) : '') : null);
    }),

    h('div', { className: 'table__foot' },
      'Cifras en USD. Pase el cursor sobre una cuenta para ver su definición. '
      + 'Verde: mejoró · rojo: empeoró (un costo que sube es rojo).'));
}

/**
 * Cuentas de entrada × meses. Cada celda se edita en su lugar; dejarla vacía
 * borra la cifra. Los totales no aparecen: se calculan, no se escriben.
 */
function ValuesGrid({ last, refreshKey, onChanged }) {
  const first = shift(last, -(GRID_MONTHS - 1));
  const { data, error } = useAsync(() => api.getPlanValues(first, last), [first, last, refreshKey]);

  const save = async (account, period, typed) => {
    const text = String(typed ?? '').trim().replace(/\s/g, '');
    let amount = null;
    if (text !== '') {
      // "9500", "9.500,50" o "9500.5": el punto de miles se quita si hay coma.
      const normalised = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
      amount = Number(normalised);
      if (!Number.isFinite(amount)) throw new Error('Tiene que ser un número.');
    }
    await api.savePlanValues([{ account_key: account, period, amount }]);
    onChanged();
  };

  if (error) return h('p', { className: 'form-error' }, error.message);
  if (!data) return null;

  const style = {
    gridTemplateColumns: `minmax(200px, 2fr) repeat(${data.periods.length}, minmax(96px, 1fr))`,
    minWidth: `${200 + data.periods.length * 104}px`,
  };

  return h('section', { className: 'statement-values' },
    h('h2', { className: 'settings__title' }, 'Cifras por mes'),
    h('p', { className: 'settings__hint' },
      'Las cuentas que se llenan a mano. Haga clic en una celda para escribir; '
      + 'vacía, la cifra se borra. Los totales se calculan solos.'),
    h(Card, { className: 'table statement' },
      h('div', { className: 'table__head', style },
        h('div', null, 'Cuenta'),
        data.periods.map((p) => h('div', { key: p, className: 'is-right' }, periodName(p)))),
      data.accounts.map((account) => h('div', {
        key: account.key,
        className: `table__row statement__row statement__row--${account.kind}`, style,
      },
        h('div', {
          className: 'statement__name', style: { paddingLeft: `${account.level * 18}px` },
        }, account.name),
        account.kind === 'input'
          ? data.periods.map((p) => {
              const value = data.values[p]?.[account.key];
              return h('div', { key: p, className: 'is-right is-actions' },
                h(EditableCell, {
                  value: value ?? '',
                  display: value != null ? figure(value, account.unit) : undefined,
                  placeholder: '·',
                  align: 'right',
                  onSave: (typed) => save(account.key, p, typed),
                }));
            })
          : data.periods.map((p) => h('div', { key: p }))))));
}
