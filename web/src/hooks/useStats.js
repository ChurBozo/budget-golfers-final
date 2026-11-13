// VIEWMODEL for the dashboard: one GET /api/stats/:userId?period= feeds the
// stat cards, the score trend chart and the accuracy card (A2 Table 5).
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import * as statsService from '../services/statsService';
import { formatDate, periodInfo } from '../utils/format';
import { useResource } from './useResource';

export function useStats(period) {
  const { user } = useAuth();
  const userId = user?.id;
  const { data, loading, error, reload } = useResource(
    userId ? `stats:${userId}:${period}` : null,
    (signal) => statsService.get(userId, period, signal),
  );

  // Derived values for the view: the trend in date order for the chart, and
  // the wording of each card.
  const view = useMemo(() => {
    if (!data) return null;
    const info = periodInfo(period);
    const trend = [...data.trend].reverse().map((t) => ({
      ...t,
      label: formatDate(t.playedAt).replace(/ \d{4}$/, ''),
    }));
    return {
      ...data,
      trendChronological: trend,
      previousLabel: info.previous,
      isEmpty: data.roundsInPeriod === 0,
    };
  }, [data, period]);

  return { stats: view, loading, error, reload };
}
