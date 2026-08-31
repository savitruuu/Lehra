import { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";

/**
 * Account summary and sign-out.
 *
 * Signing in (or choosing to continue as a guest) happens in AuthGate,
 * before Shell - and therefore this screen - ever mounts, so `user` is
 * always set here, but it may be a guest (`user.guest`, no name/email - see
 * continueAsGuest in AuthContext).
 */
export function AccountPanel() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="glass-panel"
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 600 }}
    >
      {user.guest ? (
        <div>
          <h4 style={{ fontWeight: 600, margin: 0 }}>Guest</h4>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            You're using Lehra without an account.
          </p>
        </div>
      ) : (
        <div>
          <h4 style={{ fontWeight: 600, margin: 0 }}>{user.name}</h4>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {user.email}
          </p>
        </div>
      )}
      <button className="btn" style={{ alignSelf: "flex-start" }} onClick={onLogout} disabled={busy}>
        {user.guest ? "Sign In / Create Account" : "Sign Out"}
      </button>
    </div>
  );
}
