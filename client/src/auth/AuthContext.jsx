import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../lib/api.js";

/**
 * Who is signed in, if anyone.
 *
 * Reaching the app requires either signing in or choosing "Continue without
 * an account" (see AuthGate, which is what actually reads `user` to decide
 * whether to render Shell or the gate). A guest session is just
 * `{ guest: true }` in `user` - no server round-trip, since practice logs and
 * settings are local-only (see api.js). This context only holds the session
 * state and the calls that change it.
 *
 * The session is kept as-is once established: the signed-in user is persisted
 * to localStorage and restored on every app open, with NO server round-trip to
 * re-check it. Credentials are verified exactly once - at login/signup - and
 * not again until the user explicitly logs out and logs back in. (The httpOnly
 * JWT cookie is still what authenticates any real API call; this app just does
 * not gate the UI behind re-confirming it on load.)
 *
 * `status` is always "ready" now - there is no "we have not asked the server
 * yet" phase - but it is kept so AuthGate's existing check stays valid.
 */
const AuthContext = createContext(null);

const AUTH_USER_KEY = "lehra_auth_user";

function loadStoredUser() {
  const stored = localStorage.getItem(AUTH_USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

function storeUser(user) {
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);
  const [status] = useState("ready");

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    storeUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (email, password, name) => {
    const data = await api.signup(email, password, name);
    storeUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const verifyOtp = useCallback(async (email, code) => {
    const data = await api.verifyOtp(email, code);
    storeUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const resendOtp = useCallback((email) => api.resendOtp(email), []);

  // Guests skip the server entirely - there is no account, so nothing to
  // authenticate. `guest: true` is the only thing that distinguishes this
  // from a real signed-in user; everywhere else in the app reads local data
  // only (see api.js), so it needs no other special-casing.
  const continueAsGuest = useCallback(() => {
    const guestUser = { guest: true };
    storeUser(guestUser);
    setUser(guestUser);
  }, []);

  const logout = useCallback(async () => {
    // A guest never authenticated with the server, so there is nothing to
    // log out of there - just drop the local session.
    if (user?.guest) {
      storeUser(null);
      setUser(null);
      return;
    }
    // Clear locally even if the network call fails - a logout the user asked
    // for should not be undone by an unreachable API.
    try {
      await api.logout();
    } finally {
      storeUser(null);
      setUser(null);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, status, login, signup, verifyOtp, resendOtp, continueAsGuest, logout }}
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
