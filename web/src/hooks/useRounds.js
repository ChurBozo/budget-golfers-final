// VIEWMODELs for rounds: the list (with filters and paging) and one round.
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import * as roundsService from '../services/roundsService';
import { invalidate } from '../services/cache';
import { convertDistance } from '../utils/format';
import { useResource } from './useResource';

/** filters: { from, to, courseId, holes, sort, page, limit } */
export function useRounds(filters) {
  const { user } = useAuth();
  const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const key = user ? `rounds:${user.id}:${JSON.stringify(query)}` : null;
  const { data, loading, error, reload } = useResource(key, (signal) => roundsService.list(query, signal));
  return {
    rounds: data?.data ?? null,
    meta: data?.meta ?? null,
    loading,
    error,
    reload,
  };
}

function nineTotals(holes) {
  return holes.reduce(
    (t, h) => ({
      par: t.par + h.par,
      strokes: t.strokes + h.strokes,
      putts: t.putts + h.putts,
      distance: h.distance === null || t.distance === null ? null : t.distance + h.distance,
    }),
    { par: 0, strokes: 0, putts: 0, distance: 0 },
  );
}

export function useRound(roundId) {
  const { user } = useAuth();
  const { units } = usePreferences();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const { data, loading, error, reload } = useResource(
    user && roundId ? `round:${user.id}:${roundId}` : null,
    (signal) => roundsService.get(roundId, signal),
  );

  // Holes in the golfer's units, split into the front and back nine.
  const view = useMemo(() => {
    if (!data) return null;
    const holes = data.holes.map((h) => ({
      ...h,
      distance: convertDistance(h.distanceMetres, units),
      shots: (h.shots || []).map((s) => ({ ...s, distance: convertDistance(s.distanceMetres, units) })),
    }));
    const nines = [
      { label: 'Out', holes: holes.filter((h) => h.number <= 9) },
      { label: 'In', holes: holes.filter((h) => h.number >= 10) },
    ]
      .filter((n) => n.holes.length > 0)
      .map((n) => ({ ...n, totals: nineTotals(n.holes) }));
    return {
      ...data,
      holes,
      nines,
      totalDistance: nineTotals(holes).distance,
      shotCount: holes.reduce((s, h) => s + h.shots.length, 0),
    };
  }, [data, units]);

  // DELETE, then clear every cached view this round was part of.
  const deleteRound = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await roundsService.remove(roundId);
      invalidate('rounds:', 'round:', 'stats:', 'clubs:', 'leaderboard:', 'courses:');
      return true;
    } catch (err) {
      setDeleteError(err);
      return false;
    } finally {
      setDeleting(false);
    }
  }, [roundId]);

  return { round: view, loading, error, reload, deleteRound, deleting, deleteError };
}
