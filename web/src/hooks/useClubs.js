// VIEWMODEL for club performance: GET /api/clubs/:userId, converted to the
// golfer's units, split into clubs with enough shots and clubs without.
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import * as clubsService from '../services/clubsService';
import { convertDistance } from '../utils/format';
import { useResource } from './useResource';

export function useClubs() {
  const { user } = useAuth();
  const { units } = usePreferences();
  const { data, loading, error, reload } = useResource(user ? `clubs:${user.id}` : null, (signal) =>
    clubsService.get(user.id, signal),
  );

  const view = useMemo(() => {
    if (!data) return null;
    const clubs = data.clubs.map((c) => ({
      ...c,
      average: convertDistance(c.averageMetres, units),
      longest: convertDistance(c.longestMetres, units),
      spread: convertDistance(c.spreadMetres, units),
    }));
    const measured = clubs.filter((c) => c.enoughData).sort((a, b) => b.average - a.average);
    const longest = measured.length ? measured[0].average : 0;
    return {
      ...data,
      clubs,
      measured: measured.map((c) => ({ ...c, widthPct: longest ? Math.round((c.average / longest) * 100) : 0 })),
      notEnough: clubs.filter((c) => c.inBag && !c.enoughData && c.code !== 'putter'),
      inBagCount: clubs.filter((c) => c.inBag).length,
    };
  }, [data, units]);

  return { clubs: view, loading, error, reload };
}
