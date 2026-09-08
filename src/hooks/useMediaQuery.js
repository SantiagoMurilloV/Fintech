/** Subscribes to a CSS media query so layout logic can branch in JS. */
import { useEffect, useState } from '../core/runtime.js';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    setMatches(list.matches);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Single source of truth for the mobile breakpoint (mirrors tokens.css). */
export const useIsMobile = () => useMediaQuery('(max-width: 760px)');
