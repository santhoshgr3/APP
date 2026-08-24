import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api, getSession, saveSession, clearSession, setUnauthorizedHandler } from "../api";
import { resetToLogin } from "../navigation/navigationRef";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const hadSession = useRef(false);

  useEffect(() => {
    getSession().then((s) => { setSession(s); hadSession.current = !!s; setBooting(false); });
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  // Any API call that comes back 401 (expired/invalid token) forces a logout —
  // registered once here rather than having every screen guess what a 401 means.
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  // Whenever a live session transitions to null (forced logout, or the user tapping
  // Log out from deep inside a role's tabs), snap navigation back to Login from
  // wherever it currently is — screens don't have to handle this themselves.
  useEffect(() => {
    if (booting) return;
    if (!session && hadSession.current) resetToLogin();
    hadSession.current = !!session;
  }, [session, booting]);

  const login = useCallback(async (token, user, roles) => {
    await saveSession(token, user, roles);
    setSession({ token, user, roles: roles || [user.role] });
  }, []);

  const switchRole = useCallback(async (role) => {
    const res = await api.switchRole(role);
    // Save the new token first — /auth/me below needs it to be the one AsyncStorage
    // hands back, otherwise it'd fetch roles under the role we just switched away from.
    await saveSession(res.token, res.user);
    const me = await api.me();
    await saveSession(res.token, me.user, me.roles);
    setSession({ token: res.token, user: me.user, roles: me.roles });
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.me();
    await saveSession(session.token, res.user, res.roles);
    setSession((s) => ({ ...s, user: res.user, roles: res.roles }));
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, booting, login, logout, switchRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
