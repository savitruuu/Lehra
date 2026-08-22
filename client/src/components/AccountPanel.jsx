import { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { ApiError } from "../lib/api.js";

/**
 * Sign in, sign up, or the signed-in state, in one panel.
 *
 * Accounts stay optional here exactly as everywhere else in the app: this
 * panel is the only place `useAuth()` is consumed, and nothing outside it
 * changes based on whether `user` is set.
 */
export function AccountPanel() {
  const { user, status, login, signup, logout } = useAuth();

  if (status === "loading") {
    return (
      <div className="glass-panel" style={{ maxWidth: 600 }}>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>Checking account…</p>
      </div>
    );
  }

  return user ? <SignedIn user={user} onLogout={logout} /> : <AuthForm onLogin={login} onSignup={signup} />;
}

function SignedIn({ user, onLogout }) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await onLogout();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="glass-panel"
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 600 }}
    >
      <div>
        <h4 style={{ fontWeight: 600, margin: 0 }}>{user.name}</h4>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
          {user.email}
        </p>
      </div>
      <button className="btn" style={{ alignSelf: "flex-start" }} onClick={onClick} disabled={busy}>
        Sign Out
      </button>
    </div>
  );
}

function AuthForm({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await onSignup(email, password, name);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="glass-panel"
      style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}
    >
      <div className="btn-group">
        <button
          type="button"
          className={"btn" + (mode === "login" ? " btn-primary" : "")}
          onClick={() => switchMode("login")}
        >
          Sign In
        </button>
        <button
          type="button"
          className={"btn" + (mode === "signup" ? " btn-primary" : "")}
          onClick={() => switchMode("signup")}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "signup" && (
          <input
            className="text-input"
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        )}
        <input
          className="text-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="text-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          required
        />

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create Account" : "Sign In"}
        </button>

        <p
          style={{ fontSize: 13, minHeight: 18, margin: 0, color: "var(--accent-red)" }}
          role="status"
        >
          {error || ""}
        </p>
      </form>

      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
        Optional — the player, practice log and settings all work without an account.
      </p>
    </div>
  );
}
