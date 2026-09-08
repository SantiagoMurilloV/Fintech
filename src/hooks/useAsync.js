/**
 * Data-fetching hook: runs an async function and exposes {data, error,
 * loading, reload}. Re-runs whenever `deps` change.
 */
import { useCallback, useEffect, useRef, useState } from '../core/runtime.js';

export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const latestCall = useRef(0);

  useEffect(() => {
    const callId = ++latestCall.current;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    asyncFn()
      .then((data) => {
        // Ignore responses from superseded calls (out-of-order fetches).
        if (!cancelled && callId === latestCall.current) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error) => {
        if (!cancelled && callId === latestCall.current) {
          setState({ data: null, error, loading: false });
        }
      });

    return () => { cancelled = true; };
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
