import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api.js";

/**
 * Who is signed in, if anyone.
 *
 * Signing in is mandatory to reach the app - see AuthGate, which is what
 * actually reads `user` to decide whether to render Shell or the gate. This
 * context only holds the session state and the calls that change it.
 *
 * `status` distinguishes "we have not asked the server yet" from "we asked and
 * nobody is signed in", which matters so AuthGate doesn't flash the sign-in
 * form for a moment before a valid session is confirmed.
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

  const verifyOtp = useCallback(async (email, code) => {
    const data = await api.verifyOtp(email, code);
    setUser(data.user);
    return data.user;
  }, []);

  const resendOtp = useCallback((email) => api.resendOtp(email), []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, status, login, signup, verifyOtp, resendOtp, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
