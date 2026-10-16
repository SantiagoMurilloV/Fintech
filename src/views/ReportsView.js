/**
 * Análisis derivado de la data.
 *
 * El backend perfila lo que hay — dimensiones nativas y columnas que trajo la
 * fuente — y devuelve bloques tipados (KPIs, gráficos, lecturas). Esta vista
 * solo los pinta con el mismo renderer del chat: si mañana la data cambia de
 * forma, el análisis cambia con ella sin tocar esta pantalla.
 *
 * El análisis se genera una sola vez y queda cacheado en el backend: volver a
 * entrar lo trae al instante. Regenerarlo cuesta llamadas al modelo, así que
 * solo pasa cuando el usuario oprime «Actualizar análisis»; si entró
 * información nueva, un aviso se lo dice en lugar de recalcular solo.
 */
import { h, useState } from '../core/runtime.js';
import { api } from '../core/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { BlockRenderer } from '../components/blocks/BlockRenderer.js';
import { Button } from '../components/Button.js';
import { PageHeader } from '../components/PageHeader.js';

/** Where the screen remembers the last tab the viewer opened. */
const TAB_KEY = 'fa.analysis.tab';

function savedTab() {
  try { return localStorage.getItem(TAB_KEY) || ''; } catch { return ''; }
}

/**
 * Tab bar plus the open tab's blocks. Arrow keys move between tabs, as in any
 * tab list; the choice survives a reload.
 */
function AnalysisTabs({ tabs }) {
  const [chosen, setChosen] = useState(savedTab);
  const active = tabs.find((tab) => tab.key === chosen) || tabs[0];

  const open = (key) => {
    setChosen(key);
    try { localStorage.setItem(TAB_KEY, key); } catch { /* not kept; harmless */ }
  };

  const onKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = tabs.indexOf(active);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    open(next.key);
    event.currentTarget.querySelector(`[data-tab="${next.key}"]`)?.focus();
  };

  return h('div', { className: 'analysis' },
    h('div', { className: 'analysis__tabs', role: 'tablist', 'aria-label': 'Secciones del análisis', onKeyDown },
      tabs.map((tab) => h('button', {
        key: tab.key,
        type: 'button',
        role: 'tab',
        id: `analysis-tab-${tab.key}`,
        'data-tab': tab.key,
        'aria-selected': tab.key === active.key ? 'true' : 'false',
        'aria-controls': 'analysis-panel',
        tabIndex: tab.key === active.key ? '0' : '-1',
        className: `analysis__tab ${tab.key === active.key ? 'is-active' : ''}`.trim(),
        onClick: () => open(tab.key),
      }, tab.label))),
    h('section', {
      id: 'analysis-panel',
      className: 'analysis__panel',
      role: 'tabpanel',
      'aria-labelledby': `analysis-tab-${active.key}`,
    },
      active.detail ? h('p', { className: 'analysis__detail' }, active.detail) : null,
      h(BlockRenderer, { key: active.key, blocks: active.blocks })));
}

/** "2026-08-05T14:32:10" -> "2026-08-05 14:32". */
const stampLabel = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) : '');

export function ReportsView({ refreshKey }) {
  const { data, loading, error, reload } = useAsync(() => api.getInsights(), [refreshKey]);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [failure, setFailure] = useState('');

  // Regenera a pedido y relee el caché recién guardado.
  const refreshAnalysis = async () => {
    setUpdating(true);
    setSaved('');
    setFailure('');
    try {
      await api.refreshInsights();
      reload();
    } catch (err) {
      setFailure(err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Congela el análisis en pantalla como PDF dentro de Reportes.
  const saveReport = async () => {
    setSaving(true);
    setSaved('');
    setFailure('');
    try {
      const report = await api.saveInsightsReport();
      setSaved(`«${report.title}» quedó guardado en Reportes.`);
    } catch (err) {
      setFailure(err.message);
    } finally {
      setSaving(false);
    }
  };

  return h('div', { className: 'page page--insights' },
    h(PageHeader, {
      title: 'Análisis',
      subtitle: data?.generated_at
        ? `Generado el ${stampLabel(data.generated_at)} · solo se recalcula cuando usted lo pide`
        : 'Indicadores y lecturas derivados de los datos actuales',
      actions: [
        h(Button, {
          key: 'refresh', disabled: updating || loading,
          onClick: refreshAnalysis,
        }, updating ? 'Actualizando…' : 'Actualizar análisis'),
        h(Button, {
          key: 'save', variant: 'primary', disabled: saving || loading || updating,
          onClick: saveReport,
        }, saving ? 'Guardando…' : 'Guardar reporte'),
      ],
    }),

    data?.stale && !updating
      ? h('p', { className: 'form-notice form-notice--warning' },
          'Entró información nueva después de generar este análisis. ' +
          'Oprima «Actualizar análisis» para incluirla.')
      : null,

    saved ? h('p', { className: 'form-notice' }, saved) : null,
    failure ? h('p', { className: 'form-error' }, failure) : null,
    error ? h('p', { className: 'form-error' }, error.message) : null,
    loading && !data
      ? h('p', { className: 'muted' }, 'Analizando los datos…')
      : null,
    updating
      ? h('p', { className: 'muted' }, 'Recalculando el análisis con los datos actuales…')
      : null,

    // Tabs when the backend sends them; an older cached analysis is one list.
    data?.tabs?.length
      ? h(AnalysisTabs, { tabs: data.tabs })
      : (data ? h(BlockRenderer, { blocks: data.blocks }) : null));
}
