/**
 * Hash-based router.
 *
 * Hash routing keeps the PWA working from any static host (and offline) with
 * no server rewrite rules.
 */

const listeners = new Set();

/** Current route id, e.g. "orders" (defaults to "agent"). */
export function currentRoute() {
  return window.location.hash.replace(/^#\/?/, '') || 'agent';
}

export function navigate(route) {
  if (currentRoute() === route) return;
  window.location.hash = `#/${route}`;
}

/** Subscribe to route changes; returns an unsubscribe function. */
export function onRouteChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

window.addEventListener('hashchange', () => {
  const route = currentRoute();
  for (const listener of listeners) listener(route);
});
