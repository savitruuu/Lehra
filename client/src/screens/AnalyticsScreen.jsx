import { useEffect, useMemo, useRef } from "react";
import { TAAL_DATA } from "../engine/taalData.js";
import {
  getPracticeLogs,
  calculateAnalyticsStats,
  renderWeeklyPracticeChart
} from "../lib/practiceLog.js";

/**
 * Practice Analytics.
 *
 * Everything on this screen is computed from `lehra_practice_logs` in this
 * browser's localStorage. Nothing is fetched, and signing in changes none of
 * it - the account system knows who you are, not what you practise.
 *
 * `active` is passed rather than the screen simply unmounting because the chart
 * is a canvas: it has to be redrawn when the screen becomes visible and on
 * resize, and a canvas with no layout box measures zero and draws nothing.
 */
export function AnalyticsScreen({ active }) {
  const canvasRef = useRef(null);

  // Read once per visit rather than on every render - the log only changes when
  // a session is banked, which cannot happen while this screen is up.
  const logs = useMemo(() => (active ? getPracticeLogs() : []), [active]);
  const stats = useMemo(() => calculateAnalyticsStats(logs), [logs]);
  const recent = useMemo(() => [...logs].reverse().slice(0, 5), [logs]);

  useEffect(() => {
    if (!active) return;

    const draw = () => renderWeeklyPracticeChart(canvasRef.current, logs);
    // A frame's delay: the screen has only just been given a layout box, and a
    // canvas measured in the same tick still reports zero.
    const id = requestAnimationFrame(draw);

    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", draw);
    };
  }, [active, logs]);

  return (
    <section className={"screen" + (active ? " active" : "")} id="analytics-screen">
      <h2 style={{ fontWeight: 700 }}>Practice Analytics</h2>
      <p style={{ color: "var(--text-secondary)", marginTop: -20 }}>
        Track your Riyaaz performance and progression trends.
      </p>

      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <span className="control-label">Total Riyaaz</span>
          <div className="stat-val">{stats.totalMinutes}m</div>
        </div>
        <div className="glass-panel stat-card">
          <span className="control-label">Sessions</span>
          <div className="stat-val">{stats.totalSessions}</div>
        </div>
        <div className="glass-panel stat-card">
          <span className="control-label">Top Taal</span>
          <div
            className="stat-val"
            style={{
              fontSize: 20,
              fontWeight: 700,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {stats.favoriteTaal}
          </div>
        </div>
        <div className="glass-panel stat-card">
          <span className="control-label">Avg BPM</span>
          <div className="stat-val">{stats.avgBpm}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="glass-panel">
          <span className="control-label" style={{ display: "block", marginBottom: 20 }}>
            Riyaaz Distribution by Week
          </span>
          <div className="chart-container">
            <canvas className="chart-canvas" ref={canvasRef} />
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 15,
            maxHeight: 300,
            overflowY: "auto"
          }}
        >
          <span className="control-label">Recent Practice Logs</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recent.length === 0 ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 20
                }}
              >
                No sessions logged yet. Start practicing to record logs.
              </p>
            ) : (
              recent.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: 10,
                    background: "rgba(0, 0, 0, 0.15)",
                    border: "1px solid var(--panel-border)",
                    borderRadius: 8,
                    fontSize: 14
                  }}
                >
                  <span>
                    <strong>{TAAL_DATA[log.taal]?.name ?? log.taal}</strong>{" "}
                    ({log.bpm} BPM)
                  </span>
                  <span style={{ color: "var(--accent-cyan)" }}>
                    {Math.max(1, Math.round(log.duration / 60))} min •{" "}
                    {new Date(log.date).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
