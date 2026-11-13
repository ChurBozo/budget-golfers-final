// VIEWMODEL base: loads one resource and keeps { data, loading, error }.
// - Shows the cached copy at once while a fresh one loads (A2 section 5.7).
// - Cancels the older request with an AbortController when the key changes
//   or the view closes, so an out-of-date reply never overwrites newer data.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCached, setCached } from '../services/cache';

export function useResource(key, fetcher) {
  const cached = key ? getCached(key) : undefined;
  const [state, setState] = useState({ data: cached ?? null, loading: Boolean(key), error: null });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!key) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    const existing = getCached(key);
    setState({ data: existing ?? null, loading: true, error: null });

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        setCached(key, data);
        setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState((s) => ({ data: s.data, loading: false, error }));
      });

    return () => controller.abort();
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
