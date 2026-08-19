import { TAAL_DATA } from "../engine/taalData.js";

/** The taal glossary: every cycle the app can play, with how it is counted. */
export function TaalScreen({ active }) {
  return (
    <section className={"screen" + (active ? " active" : "")} id="taal-screen">
      <h2 style={{ fontWeight: 700 }}>Taal Glossary &amp; Information</h2>
      <p style={{ color: "var(--text-secondary)", marginTop: -20 }}>
        Learn about classical Indian rhythmic structures.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {Object.entries(TAAL_DATA).map(([key, taal]) => (
          <div className="glass-panel taal-info-card" key={key}>
            <div className="taal-info-header">
              <span>{taal.name}</span>
              <span style={{ color: "var(--accent-gold)", fontSize: 14 }}>
                {taal.matras} Beats
              </span>
            </div>

            <p style={{ fontSize: 14, marginBottom: 4, color: "var(--text-primary)" }}>
              <strong>Theka:</strong>{" "}
              <span className="bol-deva" style={{ fontSize: 19 }}>
                {taal.theka ? taal.theka.join(" ") : "N/A"}
              </span>
            </p>
            <p className="theka-latin">
              {taal.theka ? taal.theka.join(" · ") : ""}
            </p>

            <div className="taal-details-list">
              <div className="taal-details-item">
                Vibhaags (Divisions): <strong>{taal.vibhaags.join("-")}</strong>
              </div>
              <div className="taal-details-item">
                Tali Beats:{" "}
                <strong>{taal.tali_positions.join(", ") || "None"}</strong>
              </div>
              <div className="taal-details-item">
                Khali Beats:{" "}
                <strong>{taal.khali_positions.join(", ") || "None"}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
