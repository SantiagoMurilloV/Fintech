/**
 * HTTP client for the backend API.
 *
 * The backend returns raw data only; nothing here formats values for display.
 */
import { API_BASE, STORAGE_KEYS } from '../config.js';

/** Thrown for any non-2xx response so views can show `error.message`. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let onUnauthorized = () => {};

/** Register a callback invoked when the session is definitively gone. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.refresh);
}

/** Store the pair a sign-in (or a refresh) returned. */
export function setSession(session) {
  // A caller from another version of the app would pass something else
  // entirely; fail with a sentence that says so instead of a destructuring
  // error nobody can act on.
  if (!session || typeof session !== 'object' || !session.access_token) {
    throw new ApiError(
      'La aplicación quedó desactualizada. Recargue la página (Cmd+Shift+R) para continuar.', 0);
  }
  const { access_token, refresh_token, user } = session;
  localStorage.setItem(STORAGE_KEYS.token, access_token);
  if (refresh_token) localStorage.setItem(STORAGE_KEYS.refresh, refresh_token);
  if (user) {
    localStorage.setItem(STORAGE_KEYS.email, user.email || '');
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || 'null');
  } catch {
    return null;
  }
}

export function clearSession() {
  for (const key of [STORAGE_KEYS.token, STORAGE_KEYS.refresh,
                     STORAGE_KEYS.email, STORAGE_KEYS.user]) {
    localStorage.removeItem(key);
  }
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

/**
 * Renews the access token, at most once at a time.
 *
 * Several requests can hit an expired token together; they all await the same
 * renewal instead of each burning a refresh token — which, with rotation on
 * the backend, would invalidate the session.
 */
let renewal = null;

// Endpoints that establish a session: their 401 is an answer, not a state.
const AUTH_PATHS = ['/api/login', '/api/refresh'];

function renewSession() {
  if (renewal) return renewal;
  const refresh_token = getRefreshToken();
  if (!refresh_token) return Promise.resolve(false);

  renewal = fetch(`${API_BASE}/api/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  })
    .then(async (response) => {
      if (!response.ok) return false;
      setSession(await response.json());
      return true;
    })
    .catch(() => false)
    .finally(() => { renewal = null; });

  return renewal;
}

async function request(path, { method = 'GET', body, headers = {}, retry = true } = {}) {
  const options = { method, headers: authHeaders(headers) };

  if (body instanceof FormData) {
    options.body = body; // let the browser set the multipart boundary
  } else if (body !== undefined) {
    options.headers = { ...options.headers, 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0);
  }

  // A 401 from signing in means wrong credentials, not an expired session:
  // it must reach the form with the server's own message.
  if (response.status === 401 && !AUTH_PATHS.includes(path)) {
    // An expired access token is renewed once and the request replayed, so a
    // 30-minute token never interrupts what the user was doing.
    if (retry && getRefreshToken() && await renewSession()) {
      return request(path, { method, body, headers, retry: false });
    }
    clearSession();
    onUnauthorized();
    throw new ApiError('Su sesión expiró. Vuelva a ingresar.', 401);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.detail || payload.error || `Error ${response.status}`, response.status);
  }
  return payload;
}

/** Download a file through the API and trigger a browser save dialog. */
export async function download(path, filename) {
  const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!response.ok) throw new ApiError('No se pudo generar la descarga.', response.status);
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Same URL, carrying the session as a query parameter.
 *
 * An <iframe> or <img> cannot send the Authorization header, so file views
 * (the PDF modal, receipt previews) authenticate through `?token=`, which the
 * backend accepts for direct links.
 */
export function withToken(url) {
  const token = getToken();
  // Files stored elsewhere (Cloudinary) carry their own access; our session
  // must never be appended to a third-party URL.
  if (!url || !token || !url.startsWith(API_BASE)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

export const api = {
  login: (email, password) => request('/api/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/api/logout', {
    method: 'POST', body: { refresh_token: getRefreshToken() || '' },
  }),
  me: () => request('/api/me'),
  changePassword: (current_password, new_password) =>
    request('/api/me/password', { method: 'POST', body: { current_password, new_password } }),

  listUsers: () => request('/api/users'),
  createUser: (user) => request('/api/users', { method: 'POST', body: user }),
  updateUser: (id, changes) => request(`/api/users/${id}`, { method: 'PATCH', body: changes }),
  resetUserPassword: (id) => request(`/api/users/${id}/password`, { method: 'POST' }),
  revokeUserSessions: (id) => request(`/api/users/${id}/sessions/revoke`, { method: 'POST' }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),

  listOrders: ({ status, limit, offset } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit != null) params.set('limit', limit);
    if (offset != null) params.set('offset', offset);
    return request(`/api/orders?${params}`);
  },
  createOrder: (order) => request('/api/orders', { method: 'POST', body: order }),
  // Partial edit from the editable table: only the given fields are written.
  updateOrder: (id, changes) =>
    request(`/api/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),

  listExpenses: () => request('/api/expenses'),
  createExpense: (expense) => request('/api/expenses', { method: 'POST', body: expense }),
  updateExpense: (id, changes) =>
    request(`/api/expenses/${id}`, { method: 'PATCH', body: changes }),
  uploadReceipt: (expenseId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/api/expenses/${expenseId}/receipt`, { method: 'POST', body: form });
  },
  // El lápiz mágico: el backend arma el comprobante PDF con los datos de la fila.
  generateReceipt: (expenseId) =>
    request(`/api/expenses/${expenseId}/receipt/generate`, { method: 'POST' }),

  getReport: (period) => request(`/api/reports${period ? `?period=${period}` : ''}`),
  getInsights: () => request('/api/insights'),
  // Regenerating costs LLM calls; it only happens when the user asks for it.
  refreshInsights: () => request('/api/insights/refresh', { method: 'POST' }),
  // Cheap probe: did the data move since the analysis was generated?
  getInsightsStatus: () => request('/api/insights/status'),
  saveInsightsReport: () => request('/api/insights/report', { method: 'POST' }),
  listSavedReports: (kind) => request(`/api/reports/saved${kind ? `?kind=${kind}` : ''}`),
  getSavedReport: (id) => request(`/api/reports/saved/${id}`),
  renameSavedReport: (id, title) =>
    request(`/api/reports/saved/${id}`, { method: 'PATCH', body: { title } }),
  deleteSavedReport: (id) => request(`/api/reports/saved/${id}`, { method: 'DELETE' }),

  // Writes a user-defined column on one row (not for computed columns).
  setCell: (entity, rowId, key, value) =>
    request('/api/columns/cell', {
      method: 'POST', body: { entity, row_id: String(rowId), key, value },
    }),

  listColumns: (entity) => request(`/api/columns${entity ? `?entity=${entity}` : ''}`),
  createColumn: (column) => request('/api/columns', { method: 'POST', body: column }),
  deleteColumn: (id) => request(`/api/columns/${id}`, { method: 'DELETE' }),

  listConversations: () => request('/api/conversations'),
  getConversation: (id) => request(`/api/conversations/${id}`),
  deleteConversation: (id) => request(`/api/conversations/${id}`, { method: 'DELETE' }),
  // Empty `ids` clears the whole history.
  deleteConversations: (ids = []) =>
    request('/api/conversations/delete', { method: 'POST', body: { ids } }),
  // `context` carries the current screen so the agent can resolve "¿y esto?".
  sendMessage: (conversationId, content, attachmentIds = [], context = null) =>
    request('/api/chat', {
      method: 'POST',
      body: {
        conversation_id: conversationId,
        content,
        attachment_ids: attachmentIds,
        context,
      },
    }),
  uploadAttachment: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/chat/attachments', { method: 'POST', body: form });
  },

  importExcel: (kind, file) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    return request('/api/import/excel', { method: 'POST', body: form });
  },

  // Configuración del panel: leerla es de cualquier sesión; guardarla, del admin.
  getSettings: () => request('/api/settings'),
  saveSettings: (values) => request('/api/settings', { method: 'PUT', body: { values } }),
  probeApi: () => request('/api/settings/probe/api', { method: 'POST' }),
  syncPull: () => request('/api/settings/sync/pull', { method: 'POST' }),
  clearData: (scope) => request('/api/settings/data/clear', { method: 'POST', body: { scope } }),
  probeSheets: () => request('/api/settings/probe/sheets', { method: 'POST' }),

  integrationStatus: () => request('/api/integrations/status'),
  health: () => request('/api/health'),
};
