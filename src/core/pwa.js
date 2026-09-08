/**
 * Progressive Web App wiring: service worker registration and the
 * "add to home screen" install prompt.
 */

let deferredPrompt = null;
const installListeners = new Set();

/**
 * Register the service worker (no-op on unsupported browsers).
 *
 * When a new version takes control, the page is reloaded once. Without that,
 * the tab keeps running the modules it loaded before the update while any
 * module requested afterwards comes from the new version — a mix that fails in
 * ways no error message explains. One reload is cheaper than that.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // No controller yet means this is the first install: claiming is not an
  // update, and reloading there would be a pointless flash.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      // Ask right away instead of waiting for the browser's own schedule.
      .then((registration) => registration.update())
      .catch((error) => console.warn('Service worker registration failed:', error));
  });
}

// Chrome fires this instead of showing its own install banner.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  for (const listener of installListeners) listener(true);
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  for (const listener of installListeners) listener(false);
});

export function canInstall() {
  return deferredPrompt !== null;
}

/** Show the native install dialog; resolves to true when accepted. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  for (const listener of installListeners) listener(false);
  return outcome === 'accepted';
}

/** Subscribe to install-availability changes; returns an unsubscribe fn. */
export function onInstallAvailabilityChange(listener) {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
}
