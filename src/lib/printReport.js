/**
 * Printable report.
 *
 * This is presentation, so it belongs to the frontend: it renders the raw
 * aggregates into a print-friendly document and opens the browser print
 * dialog (which can "Save as PDF").
 */
import * as fmt from './format.js';
import { APP_NAME } from '../config.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const rows = (pairs) => pairs
  .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="right">${escapeHtml(value)}</td></tr>`)
  .join('');

export function printReport(report) {
  const d = report.deltas;
  const previous = fmt.periodName(report.prev_period);

  const missing = report.missing_receipts.length
    ? `<h2>Gastos sin comprobante</h2><ul>${report.missing_receipts.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`
    : '';

  const document_ = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Reporte ${escapeHtml(fmt.periodName(report.period))}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", sans-serif; max-width: 720px; margin: 40px auto; color: #222; }
  h1 { font-size: 22px; } h2 { font-size: 15px; margin-top: 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
  .right { text-align: right; }
  @media print { button { display: none; } }
</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 14px;cursor:pointer">Imprimir / Guardar PDF</button>
<h1>Resumen financiero · ${escapeHtml(fmt.periodName(report.period))}</h1>

<h2>Indicadores</h2>
<table>${rows([
    ['Ingresos', `${fmt.usdCompact(report.revenue_usd)} (${fmt.delta(d.revenue_pct)} vs. ${previous})`],
    ['Gastos', `${fmt.usdCompact(report.expenses_usd)} (${fmt.delta(d.expenses_pct)})`],
    ['Margen operativo', `${fmt.percent(report.margin_pct)} (${fmt.delta(d.margin_pp, ' pp')})`],
    ['Órdenes', `${fmt.integer(report.orders_count)} (${fmt.delta(d.orders, '')})`],
  ])}</table>

<h2>Volumen por gateway</h2>
<table>${rows(report.gateways.map((g) => [g.name, `${fmt.usdCompact(g.usd)} · ${fmt.percent(g.pct)}`]))}</table>

<h2>Ingresos por semana (USD eq.)</h2>
<table>${rows(report.weekly.map((w) => [`Semana ${w.week}`, fmt.usdCompact(w.usd)]))}</table>

<h2>Gastos por categoría</h2>
<table>${rows(report.expense_categories.map((c) => [c.name, fmt.usdCompact(c.usd)]))}</table>

${missing}
<p style="color:#888;font-size:12px">Generado por ${escapeHtml(APP_NAME)} · ${fmt.todayISO()}</p>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Habilite los pop-ups para exportar el PDF.');
    return;
  }
  win.document.write(document_);
  win.document.close();
}
