/** Subscribes the component tree to hash-route changes. */
import { useEffect, useState } from '../core/runtime.js';
import { currentRoute, navigate, onRouteChange } from '../core/router.js';

export function useRoute() {
  const [route, setRoute] = useState(currentRoute());
  useEffect(() => onRouteChange(setRoute), []);
  return { route, navigate };
}
