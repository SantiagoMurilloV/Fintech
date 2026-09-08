/**
 * Modal coordinator: only one modal is open at a time, so views just ask for
 * a name and payload.
 */
import { useCallback, useState } from '../core/runtime.js';

export function useModal() {
  const [modal, setModal] = useState(null); // { name, payload }

  const open = useCallback((name, payload = null) => setModal({ name, payload }), []);
  const close = useCallback(() => setModal(null), []);

  return { modal, open, close, isOpen: modal !== null };
}
