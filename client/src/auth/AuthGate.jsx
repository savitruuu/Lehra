import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { ApiError } from "../lib/api.js";

const RESEND_COOLDOWN_S = 30;

/**
 * Everything between opening the app and reaching Shell.
 *
 * Signing in is mandatory: App.jsx renders this instead of Shell whenever
 * `user` is not set, and Shell only mounts once it is. Three modes live here
 * rather than as separate routes because there is nowhere to route to yet -
 * the app has no URL-addressable screens - and because the state that moves
 * a user from one mode to the next (an email pending verification) is only
 * ever needed here.
 */
export function AuthGate() {
  const { status } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup | otp
  const [pendingEmail, setPendingEmail] = useState(null);

  if (status === "loading") {
    return (
      <div className="auth-gate">
        <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="auth-gate">
      <div className="auth-card glass-panel">
        <h1 style={{ fontWeight: 700, margin: 0 }}>Lehra</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4, marginBottom: 24 }}>
          Sign in to start your Riyaaz.
        </p>

        {mode === "otp" ? (
          <OtpForm
            email={pendingEmail}
            onVerified={() => {}}
            onBackToLogin={() => {
              setMode("login");
              setPendingEmail(null);
            }}
          />
        ) : (
          <>
            <div className="btn-group" style={{ marginBottom: 20 }}>
              <button
                type="button"
                className={"btn" + (mode === "login" ? " btn-primary" : "")}
                onClick={() => setMode("login")}
              >
                Sign In
              </button>
              <button
                type="button"
                className={"btn" + (mode === "signup" ? " btn-primary" : "")}
                onClick={() => setMode("signup")}
              >
                Create Account
              </button>
            </div>

            {mode === "login" ? (
              <LoginForm
                onNeedsVerification={(email) => {
                  setPendingEmail(email);
                  setMode("otp");
                }}
              />
            ) : (
              <SignupForm
                onSignedUp={(email) => {
                  setPendingEmail(email);
                  setMode("otp");
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LoginForm({ onNeedsVerification }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.data?.needsVerification) {
        onNeedsVerification(err.data.pendingEmail);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        className="text-input"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        autoFocus
        required
      />
      <input
        className="text-input"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Please wait…" : "Sign In"}
      </button>
      <ErrorLine error={error} />
    </form>
  );
}

function SignupForm({ onSignedUp }) {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const pendingEmail = await signup(email, password, name);
      onSignedUp(pendingEmail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        className="text-input"
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        autoFocus
        required
      />
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
        placeholder="Password (min. 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Please wait…" : "Create Account"}
      </button>
      <ErrorLine error={error} />
    </form>
  );
}

function OtpForm({ email, onBackToLogin }) {
  const { verifyOtp, resendOtp } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(`We've sent a 6-digit code to ${email}.`);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(email, code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setInfo(null);
    try {
      await resendOtp(email);
      setInfo(`We've sent a new code to ${email}.`);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection.");
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        className="text-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        autoComplete="one-time-code"
        autoFocus
        required
        style={{ letterSpacing: 6, textAlign: "center", fontSize: 20 }}
      />
      <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Verifying…" : "Verify"}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          className="btn"
          style={{ padding: "8px 14px", fontSize: 13 }}
          onClick={onBackToLogin}
        >
          Back
        </button>
        <button
          type="button"
          className="btn"
          style={{ padding: "8px 14px", fontSize: 13 }}
          onClick={onResend}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>

      {error ? (
        <ErrorLine error={error} />
      ) : (
        <p style={{ fontSize: 13, minHeight: 18, margin: 0, color: "var(--text-secondary)" }} role="status">
          {info}
        </p>
      )}
    </form>
  );
}

function ErrorLine({ error }) {
  return (
    <p style={{ fontSize: 13, minHeight: 18, margin: 0, color: "var(--accent-red)" }} role="status">
      {error || ""}
    </p>
  );
}
