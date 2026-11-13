// VIEWMODEL for the leaderboard: sort and period come from the URL; "Load more"
// appends the next page. meta.currentUser highlights the golfer's own row.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as leaderboardService from '../services/leaderboardService';
import { getCached, setCached } from '../services/cache';

const PAGE_SIZE = 25;

export function useLeaderboard({ sort, period }) {
  const { user } = useAuth();
  const userId = user?.id;
  const key = `leaderboard:${sort}:${period}`;
  const [state, setState] = useState(() => getCached(key) ?? { rows: null, meta: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(getCached(key) ?? { rows: null, meta: null });
    setLoading(true);
    setError(null);
    leaderboardService
      .list({ sort, period, page: 1, limit: PAGE_SIZE }, controller.signal)
      .then(({ data, meta }) => {
        const next = { rows: data, meta };
        setCached(key, next);
        setState(next);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err);
        setLoading(false);
      });
    return () => controller.abort();
  }, [key, sort, period, userId, nonce]);

  const loadMore = useCallback(async () => {
    if (!state.meta) return;
    setLoadingMore(true);
    try {
      const { data, meta } = await leaderboardService.list({ sort, period, page: state.meta.page + 1, limit: PAGE_SIZE });
      setState((s) => {
        const next = { rows: [...(s.rows || []), ...data], meta };
        setCached(key, next);
        return next;
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [state.meta, sort, period, key]);

  const rows = state.rows;
  const hasMore = Boolean(state.meta && rows && rows.length < state.meta.total);

  return {
    rows,
    meta: state.meta,
    me: state.meta?.currentUser ?? null,
    myUserId: userId,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    reload: () => setNonce((n) => n + 1),
  };
}
