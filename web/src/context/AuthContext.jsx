// Shared state (part of the model): the signed-in golfer and their token.
// The token is kept in memory and in sessionStorage, so a page refresh keeps
// the session but closing the tab ends it (A2 section 5.7).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureApi } from '../services/apiClient';
import * as authService from '../services/authService';
import * as usersService from '../services/usersService';
import { clearCache } from '../services/cache';

const STORAGE_KEY = 'bg.session';
const AuthContext = createContext(null);

function readSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.token || Date.now() >= session.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private windows can refuse storage; the session then lasts until refresh.
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession); // { token, expiresAt, user }
  const [expired, setExpired] = useState(false);
  // The token lives in memory first; sessionStorage is only the refresh copy.
  const sessionRef = useRef(session);

  const save = useCallback((next) => {
    sessionRef.current = next;
    writeSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(
    (reason) => {
      clearCache();
      save(null);
      setExpired(reason === 'expired');
    },
    [save],
  );

  // The service layer reads the token and reports a 401 through here. This
  // runs during render (not in an effect) because the views' effects run
  // first and would otherwise send their first requests without the token.
  configureApi({
    getToken: () => sessionRef.current?.token ?? null,
    onUnauthorized: () => signOut('expired'),
  });

  // Sign out when the token runs out while the tab is open.
  useEffect(() => {
    if (!session) return undefined;
    const ms = session.expiresAt - Date.now();
    const timer = setTimeout(() => signOut('expired'), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(timer);
  }, [session, signOut]);

  // UserChip: refresh the profile (name, handicap, preferences) on app start.
  const token = session?.token;
  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    usersService
      .me(controller.signal)
      .then((user) => {
        const current = sessionRef.current;
        if (current) save({ ...current, user });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [token, save]);

  const begin = useCallback(
    async ({ token: newToken, expiresIn, user }) => {
      clearCache();
      setExpired(false);
      const next = { token: newToken, expiresAt: Date.now() + expiresIn * 1000, user };
      save(next);
      return next;
    },
    [save],
  );

  const signIn = useCallback(async (credentials) => begin(await authService.login(credentials)), [begin]);
  const register = useCallback(async (details) => begin(await authService.register(details)), [begin]);

  const updateUser = useCallback(
    (user) => {
      const current = sessionRef.current;
      if (current) save({ ...current, user: { ...current.user, ...user } });
    },
    [save],
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isSignedIn: Boolean(session),
      expired,
      signIn,
      register,
      signOut,
      updateUser,
    }),
    [session, expired, signIn, register, signOut, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
