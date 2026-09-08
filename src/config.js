/**
 * Frontend configuration.
 *
 * API_BASE resolves, in order: env.js written at deploy time (see
 * scripts/build.mjs), a manual override kept in localStorage, and the local
 * backend. The same code therefore runs against :8000 in development and
 * against the deployed API in production without a bundler.
 */

export const API_BASE =
  window.__API_BASE__ || localStorage.getItem('fa.apiBase') || 'http://localhost:8000';

export const APP_NAME = 'Mandioca';

/**
 * Visible app version, shown in the sidebar.
 *
 * Tells at a glance whether the browser is running the current code or a
 * stale cached copy. Bump it together with `VERSION` in service-worker.js on
 * every frontend change.
 */
export const APP_VERSION = 'v28';

/** Rows requested per page in paginated tables. */
export const PAGE_SIZE = 25;

/** Locale used for every number/date the UI formats. */
export const LOCALE = 'es-CO';

/** localStorage keys, centralized to avoid typos across modules. */
export const STORAGE_KEYS = {
  token: 'fa.token',           // access JWT (short-lived)
  refresh: 'fa.refresh',       // refresh token (long-lived, revocable)
  user: 'fa.user',             // signed-in account, painted without waiting for the server
  email: 'fa.email',
  theme: 'fa.theme',
};
