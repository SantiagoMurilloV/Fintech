/**
 * Watches for data the cached analysis has not seen yet.
 *
 * The backend sync loop is the one actually listening to the endpoint or the
 * sheet; this hook polls its cheap status endpoint and raises one alert per
 * analysis version, so the user learns there is new information right away
 * without the app regenerating anything by itself.
 */
import { useEffect, useRef, useState } from '../core/runtime.js';
import { api } from '../core/api.js';

const POLL_MS = 30000;

export function useInsightsAlert(enabled) {
  const [alert, setAlert] = useState(false);
  // The analysis version already announced: one toast per version, not per poll.
  const announced = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;

    const check = async () => {
      try {
        const status = await api.getInsightsStatus();
        if (stopped || !status.generated) return;
        if (status.stale && announced.current !== status.generated_at) {
          announced.current = status.generated_at;
          setAlert(true);
        }
        if (!status.stale) {
          // A fresh analysis re-arms the alert for the next change.
          announced.current = null;
          setAlert(false);
        }
      } catch {
        // Offline or expired session: the next tick retries.
      }
    };

    check();
    const timer = setInterval(check, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [enabled]);

  return { alert, dismiss: () => setAlert(false) };
}
