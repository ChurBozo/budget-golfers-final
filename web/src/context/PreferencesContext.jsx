// Shared state (part of the model): units, theme and the leaderboard opt-in.
// They are saved on the golfer's account, so the app and website agree.
// Changes show at once (optimistic) and roll back if the PATCH fails (A2 Table 5).
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import * as usersService from '../services/usersService';

const DEFAULTS = { units: 'metric', theme: 'light', showOnLeaderboard: true };
const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [pending, setPending] = useState({}); // optimistic values not yet confirmed
  const [error, setError] = useState(null);

  const saved = { ...DEFAULTS, ...(user?.preferences ?? {}) };
  const preferences = { ...saved, ...pending };

  const setPreference = useCallback(
    async (key, value) => {
      if (!user) return;
      setError(null);
      setPending((p) => ({ ...p, [key]: value }));
      try {
        const updated = await usersService.update(user.id, { preferences: { [key]: value } });
        updateUser(updated);
      } catch (err) {
        setError(err.message || 'That setting could not be saved.');
      } finally {
        setPending((p) => {
          const { [key]: _done, ...rest } = p;
          return rest;
        });
      }
    },
    [user, updateUser],
  );

  const value = useMemo(
    () => ({ ...preferences, setPreference, error, clearError: () => setError(null) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preferences.units, preferences.theme, preferences.showOnLeaderboard, setPreference, error],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}
