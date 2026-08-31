import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { ApiError } from "../lib/api.js";
import { BrandMark } from "../components/Navigation.jsx";
import { loadSettings, saveSettings, applyTheme, PALETTE_OPTIONS } from "../lib/settings.js";

const RESEND_COOLDOWN_S = 30;

/** A swatch colour per palette, for the picker - the accent each one paints
    buttons and links with, night variant since that is the shipped default. */
const PALETTE_SWATCHES = {
  default: "#D2603B",
  moss: "#89d7b7",
  midnight: "#7c8798",
  deepocean: "#59d6dc"
};

/**
 * Everything between opening the app and reaching Shell.
 *
 * App.jsx renders this instead of Shell whenever `user` is not set, and
 * Shell only mounts once it is - either a real signed-in user or a guest
 * (see continueAsGuest in AuthContext). Three modes live here rather than as
 * separate routes because there is nowhere to route to yet - the app has no
 * URL-addressable screens - and because the state that moves a user from one
 * mode to the next (an email pending verification) is only ever needed here.
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
      <ThemePicker />
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-row">
            <div className="brand-logo auth-brand-logo">
              <BrandMark size={22} />
            </div>
            <h1>Lehra</h1>
          </div>
          <p className="auth-subtitle">Sign in to start your Riyaaz, or try it without an account.</p>
        </div>

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
            <div className="auth-mode-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={"auth-mode-tab" + (mode === "login" ? " active" : "")}
                onClick={() => setMode("login")}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={"auth-mode-tab" + (mode === "signup" ? " active" : "")}
                onClick={() => setMode("signup")}
              >
                Create Account
              </button>
            </div>

            {mode === "login" ? (
              <>
                <LoginForm
                  onNeedsVerification={(email) => {
                    setPendingEmail(email);
                    setMode("otp");
                  }}
                />
                <GuestOption />
              </>
            ) : (
              <SignupForm />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Top-right theme/palette control - the one piece of Settings a person might
    want before they even have an account. Applies and saves immediately,
    same as the live preview in SettingsScreen. */
function ThemePicker() {
  const [settings, setSettings] = useState(loadSettings);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const update = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    applyTheme(next);
    saveSettings(next);
  };

  return (
    <div className="auth-theme-picker" ref={rootRef}>
      <button
        type="button"
        className="auth-theme-btn"
        aria-label="Change theme and color palette"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12,2C6.49,2 2,6.49 2,12C2,17.51 6.49,22 12,22C13.4,22 14.5,20.9 14.5,19.5C14.5,18.83 14.24,18.19 13.77,17.75C13.42,17.4 13.25,16.9 13.25,16.5C13.25,15.62 13.87,15 14.75,15H17C19.76,15 22,12.76 22,10C22,5.58 17.5,2 12,2M6.5,12C5.67,12 5,11.33 5,10.5C5,9.67 5.67,9 6.5,9C7.33,9 8,9.67 8,10.5C8,11.33 7.33,12 6.5,12M9.5,8C8.67,8 8,7.33 8,6.5C8,5.67 8.67,5 9.5,5C10.33,5 11,5.67 11,6.5C11,7.33 10.33,8 9.5,8M14.5,8C13.67,8 13,7.33 13,6.5C13,5.67 13.67,5 14.5,5C15.33,5 16,5.67 16,6.5C16,7.33 15.33,8 14.5,8M17.5,12C16.67,12 16,11.33 16,10.5C16,9.67 16.67,9 17.5,9C18.33,9 19,9.67 19,10.5C19,11.33 18.33,12 17.5,12Z" />
        </svg>
      </button>

      {open && (
        <div className="auth-theme-popover">
          <div className="auth-theme-section">
            <span className="auth-theme-label">Theme</span>
            <div className="auth-mode-tabs">
              <button
                type="button"
                className={"auth-mode-tab" + (settings.theme === "light" ? " active" : "")}
                onClick={() => update({ theme: "light" })}
              >
                Light
              </button>
              <button
                type="button"
                className={"auth-mode-tab" + (settings.theme === "dark" ? " active" : "")}
                onClick={() => update({ theme: "dark" })}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="auth-theme-section">
            <span className="auth-theme-label">Color Palette</span>
            <div className="auth-palette-row">
              {PALETTE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={"auth-palette-swatch" + (settings.palette === opt.value ? " active" : "")}
                  style={{ background: PALETTE_SWATCHES[opt.value] }}
                  aria-label={opt.label}
                  aria-pressed={settings.palette === opt.value}
                  title={opt.label}
                  onClick={() => update({ palette: opt.value })}
                />
              ))}
            </div>
          </div>
        </div>
      )}
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

/** Escape hatch on the sign-in tab for someone who wants to try the app
    before creating an account - see continueAsGuest in AuthContext. */
function GuestOption() {
  const { continueAsGuest } = useAuth();
  return (
    <button
      type="button"
      className="btn"
      style={{ marginTop: 4, fontSize: 13 }}
      onClick={continueAsGuest}
    >
      Continue without an account
    </button>
  );
}

function SignupForm() {
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
      await signup(email, password, name);
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
