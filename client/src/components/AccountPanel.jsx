import { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";

/**
 * Account summary and sign-out.
 *
 * Signing in itself happens in AuthGate, before Shell - and therefore this
 * screen - ever mounts, so `user` is always set here.
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
      <div>
        <h4 style={{ fontWeight: 600, margin: 0 }}>{user.name}</h4>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
          {user.email}
        </p>
      </div>
      <button className="btn" style={{ alignSelf: "flex-start" }} onClick={onLogout} disabled={busy}>
        Sign Out
      </button>
    </div>
  );
}
