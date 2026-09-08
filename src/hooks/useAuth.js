/**
 * Session hook.
 *
 * The access token is short-lived and renewed by the API client on its own;
 * this hook only holds who is signed in. Both tokens live in localStorage so a
 * reload — or launching the installed PWA — keeps the session.
 */
import { useCallback, useEffect, useState } from '../core/runtime.js';
import {
  api, clearSession, getStoredUser, getToken, setSession, setUnauthorizedHandler,
} from '../core/api.js';

export function useAuth() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

  // A session the backend no longer accepts drops the local one too.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setUser(null);
    });
  }, []);

  /** Re-read the signed-in account from the server. */
  const refreshUser = useCallback(async () => {
    if (!getToken()) return null;
    try {
      const fresh = await api.me();
      setSession({ access_token: getToken(), user: fresh });
      setUser(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  // The stored account may be stale — an admin changed a role, or disabled it
  // — so it is confirmed against the server on load.
  useEffect(() => { refreshUser(); }, []);

  const login = useCallback(async (email, password) => {
    const session = await api.login(email, password);
    setSession(session);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(() => {
    api.logout().catch(() => {});   // best effort; the local state is authoritative
    clearSession();
    setUser(null);
  }, []);

  /**
   * Change your own password.
   *
   * The backend closes every session — the old refresh token belonged to the
   * old password — and hands back a fresh pair, so this tab stays signed in
   * while any other one is dropped.
   */
  const changePassword = useCallback(async (current, next) => {
    const session = await api.changePassword(current, next);
    setSession(session);
    setUser(session.user);
    return session.user;
  }, []);

  return {
    user,
    email: user?.email || '',
    role: user?.role || null,
    isAdmin: user?.role === 'admin',
    isAuthenticated: Boolean(user),
    // An account created or reset by an admin must pick a password first.
    mustChangePassword: Boolean(user?.must_change_password),
    login,
    logout,
    changePassword,
    refreshUser,
  };
}
