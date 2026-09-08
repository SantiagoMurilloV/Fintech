/**
 * Every display formatting rule lives here.
 *
 * The API sends raw numbers, ISO dates and status codes; this module is the
 * single place that turns them into strings a human reads.
 */
import { LOCALE } from '../config.js';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Currencies without decimals in everyday use. */
const ZERO_DECIMAL_CURRENCIES = new Set(['COP']);

/** Amount in its own currency, e.g. 4850000 COP -> "4.850.000". */
export function amount(value, currency) {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value ?? 0);
}

/**
 * Compact USD equivalent, e.g. 512400 -> "USD 512,4 k".
 *
 * Below a thousand the "k" notation misleads: USD 0.81 shown as "0,0 k" reads
 * like a bug (or like zero money). Small totals show their real value.
 */
export function usdCompact(usd) {
  const amount = usd ?? 0;
  if (Math.abs(amount) < 1000) {
    const value = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `USD ${value}`;
  }
  const value = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(amount / 1000);
  return `USD ${value} k`;
}

/** Thousands separator only, e.g. 1284 -> "1.284". */
export function integer(value) {
  return new Intl.NumberFormat(LOCALE).format(value ?? 0);
}

/** Signed percentage for deltas, e.g. 8.2 -> "+8,2%". */
export function delta(value, suffix = '%') {
  if (value == null) return 's/d';
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

/** Percentage as a CSS width, clamped so tiny bars stay visible. */
export function percentWidth(value, total, minimum = 2) {
  if (!total) return `${minimum}%`;
  return `${Math.max(Math.round((100 * value) / total), minimum)}%`;
}

/** Percentage label, e.g. 44.7 -> "44,7%". */
export function percent(value) {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value ?? 0)}%`;
}

/** ISO date -> short label, e.g. "2026-07-31" -> "31 jul". */
export function shortDate(iso) {
  if (!iso) return '';
  const month = MONTHS[Number(iso.slice(5, 7)) - 1] || '';
  return `${iso.slice(8, 10)} ${month.slice(0, 3)}`;
}

/** ISO date -> "08 sep 2026"; anything shorter than a date is returned as is. */
export function dateLabel(iso) {
  if (!iso || iso.length < 10) return iso || '';
  const month = MONTHS[Number(iso.slice(5, 7)) - 1] || '';
  return `${iso.slice(8, 10)} ${month.slice(0, 3)} ${iso.slice(0, 4)}`;
}

/**
 * ISO timestamp -> "08 sep 2026, 00:20".
 *
 * Sliced, not parsed: the time shown is the wall-clock time the source
 * stamped, in the source's own zone. Parsing would shift it to the viewer's
 * zone and a payout made at 00:20 would read as the previous day.
 */
export function dateTimeLabel(iso) {
  if (!iso) return '';
  const time = iso.length >= 16 ? iso.slice(11, 16) : '';
  return time ? `${dateLabel(iso)}, ${time}` : dateLabel(iso);
}

/** "YYYY-MM" -> "Julio 2026". */
export function periodName(period) {
  if (!period) return '';
  const month = MONTHS[Number(period.slice(5, 7)) - 1] || '';
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${period.slice(0, 4)}`;
}

/** "YYYY-MM" -> "julio", used inside sentences like "vs. julio". */
export function monthName(period) {
  if (!period) return '';
  return MONTHS[Number(period.slice(5, 7)) - 1] || '';
}

/** Today as an ISO date, for date input defaults. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Initials for the user avatar, e.g. "santi.bermudez@x.co" -> "SB". */
export function initials(email) {
  if (!email) return 'U';
  const [name] = email.split('@');
  const parts = name.split(/[._-]/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Starts like an ISO date: "2026-09-08" or "2026-09-08T00:20:54-04:00". */
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/**
 * Value of a user-defined column.
 *
 * Numbers (including computed formulas) get thousand separators — two
 * decimals, six below one so a small crypto amount never reads as zero.
 * Dates and timestamps read like the rest of the table; booleans and empty
 * cells render as readable text.
 */
export function customCell(value, dataType) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number' || dataType === 'number' || dataType === 'formula') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const digits = Math.abs(numeric) < 1 ? 6 : 2;
      return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(numeric);
    }
  }
  const text = String(value);
  if (dataType === 'datetime' && ISO_DATE_PREFIX.test(text)) return dateTimeLabel(text);
  if (dataType === 'date' && ISO_DATE_PREFIX.test(text)) return dateLabel(text);
  return text;
}

/** First name from an email, capitalized: "santiago@x.co" -> "Santiago". */
export function displayName(email) {
  if (!email) return '';
  const first = email.split('@')[0].split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Time-of-day greeting, e.g. "Buenos días, Santiago". */
export function greeting(email, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const name = displayName(email);
  return name ? `${part}, ${name}` : part;
}
