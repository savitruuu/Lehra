import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api.js";

/**
 * Who is signed in, if anyone.
 *
 * Accounts are optional by design: the player, the practice log and every
 * setting work exactly the same signed out, and nothing in the app is gated on
 * `user`. This context exists so that the login screens - and, later, billing -
 * have somewhere to read from; until those are built, the only visible effect
 * of being signed in is that the server has a `lastLoginAt` for you.
 *
 * `status` distinguishes "we have not asked the server yet" from "we asked and
 * nobody is signed in", which matters once there is UI that would otherwise
 * flash a signed-out state on every load.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready

  useEffect(() => {
    let cancelled = false;

    api
      .me()
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        // The API not being up is not an error the player should ever see -
        // signed out is a perfectly good state for this app to run in.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setStatus("ready");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (email, password, name) => {
    const data = await api.signup(email, password, name);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
