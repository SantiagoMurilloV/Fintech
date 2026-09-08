/** Exposes PWA install availability to components. */
import { useEffect, useState } from '../core/runtime.js';
import { canInstall, onInstallAvailabilityChange, promptInstall } from '../core/pwa.js';

export function useInstallPrompt() {
  const [available, setAvailable] = useState(canInstall());
  useEffect(() => onInstallAvailabilityChange(setAvailable), []);
  return { available, install: promptInstall };
}
