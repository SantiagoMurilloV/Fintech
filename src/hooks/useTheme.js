/**
 * Theme hook: persists the choice and reflects it on <html data-theme>,
 * which is what the CSS custom properties key off.
 */
import { useCallback, useEffect, useState } from '../core/runtime.js';
import { STORAGE_KEYS } from '../config.js';

function initialTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored) return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    // Keep the PWA status bar / address bar in sync with the palette.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0a0c' : '#eef5f1');
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, isDark: theme === 'dark', toggle };
}
