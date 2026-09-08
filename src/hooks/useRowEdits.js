/**
 * Keeps rows edited in place ahead of the next fetch.
 *
 * Saving a cell must not refetch the table: the list would blink back to
 * "Cargando…" and the row being worked on would lose its place. The updated
 * row the backend returns is kept here and merged over the fetched one, until
 * a real reload (a filter, a page, the agent changing something) replaces it.
 */
import { useEffect, useState } from '../core/runtime.js';

export function useRowEdits(items, resetKey, idKey = 'id') {
  const [patched, setPatched] = useState({});

  // A fresh response is the truth; drop what was held locally.
  useEffect(() => {
    setPatched((prev) => (Object.keys(prev).length ? {} : prev));
  }, [resetKey]);

  const rows = items.map((row) => {
    const update = patched[row[idKey]];
    return update ? { ...row, ...update } : row;
  });

  const applyRow = (item) => setPatched((prev) => ({ ...prev, [item[idKey]]: item }));

  return [rows, applyRow];
}
