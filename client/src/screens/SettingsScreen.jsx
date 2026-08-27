import { useEffect, useState } from "react";
import { SettingsTile } from "../components/Tile.jsx";
import { RangeInput } from "../components/RangeInput.jsx";
import { AccountPanel } from "../components/AccountPanel.jsx";
import {
  loadSettings,
  saveSettings,
  applyTheme,
  PALETTE_OPTIONS
} from "../lib/settings.js";
import {
  LEHRA_TAAL_OPTIONS,
  ALL_RAAG_OPTIONS,
  INSTRUMENT_OPTIONS,
  PITCH_PLAIN_OPTIONS
} from "../lib/options.js";

// The same range the player's tempo slider allows (see PlayerContext).
const MIN_BPM = 30;
const MAX_BPM = 400;

/**
 * Application settings.
 *
 * Theme and palette apply the moment they are changed - they are what the
 * screen looks like, and a preview you have to save to see is not a preview.
 * The Default Lehra Configuration group is the opposite: it describes what the
 * app should open with next time, so it waits for Save.
 *
 * Everything here is written to this browser's localStorage. The account
 * section below is the exception - it talks to the API - but the practice
 * log, the player defaults and every other setting still live entirely in
 * the browser regardless of who is signed in.
 */
export function SettingsScreen({ active }) {
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved] = useState(false);

  // Live preview for the two that are purely visual.
  useEffect(() => {
    applyTheme({ theme: settings.theme, palette: settings.palette });
  }, [settings.theme, settings.palette]);

  const update = (patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    setSaved(false);
  };

  const onSave = () => {
    saveSettings(settings);
    setSaved(true);
  };

  return (
    <section className={"screen" + (active ? " active" : "")} id="settings-screen">
      <h2 style={{ fontWeight: 700 }}>Application Settings</h2>
      <p style={{ color: "var(--text-secondary)", marginTop: -20 }}>
        Customize your Tabla Practice Companion environment.
      </p>

      <div
        className="glass-panel"
        style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}
      >
        <div className="toggle-row">
          <div>
            <h4 style={{ fontWeight: 600 }}>Theme Toggle</h4>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Toggle between Dark Mode and Light Mode.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.theme === "dark"}
              onChange={(e) =>
                update({ theme: e.target.checked ? "dark" : "light" })
              }
            />
            <span className="slider-switch" />
          </label>
        </div>

        <SettingsTile
          id="settings-palette-tile"
          label="Color Palette"
          options={PALETTE_OPTIONS}
          value={settings.palette}
          onSelect={(palette) => update({ palette })}
        />

        <hr style={{ border: 0, borderTop: "1px solid var(--panel-border)" }} />

        <h4 style={{ fontWeight: 600, margin: 0 }}>
          Default Lehra Configuration
        </h4>

        <SettingsTile
          id="settings-pitch-tile"
          label="Default Pitch"
          options={PITCH_PLAIN_OPTIONS}
          value={settings.pitch}
          onSelect={(pitch) => update({ pitch })}
        />
        <SettingsTile
          id="settings-taal-tile"
          label="Default Taal"
          options={LEHRA_TAAL_OPTIONS}
          value={settings.taal}
          onSelect={(taal) => update({ taal })}
        />
        <SettingsTile
          id="settings-instrument-tile"
          label="Default Instrument"
          options={INSTRUMENT_OPTIONS}
          value={settings.instrument}
          onSelect={(instrument) => update({ instrument })}
        />
        <SettingsTile
          id="settings-raag-tile"
          label="Default Raag"
          options={ALL_RAAG_OPTIONS}
          value={settings.raag}
          onSelect={(raag) => update({ raag })}
        />

        <div className="slider-container">
          <div className="slider-header">
            <label className="control-label" htmlFor="settings-default-bpm">
              Default Tempo
            </label>
            <span className="slider-val">{settings.bpm} BPM</span>
          </div>
          <RangeInput
            id="settings-default-bpm"
            min={MIN_BPM}
            max={MAX_BPM}
            value={settings.bpm}
            onChange={(bpm) => update({ bpm })}
            aria-label="Default tempo in BPM"
          />
        </div>

        <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={onSave}>
          Save Configuration Defaults
        </button>

        {/* Inline rather than an alert(): a modal dialog steals focus from the
            player and, on some browsers, stalls the audio thread behind it. */}
        <p
          style={{
            fontSize: 13,
            minHeight: 18,
            margin: 0,
            color: "var(--accent-cyan)",
            opacity: saved ? 1 : 0,
            transition: "opacity 0.2s ease"
          }}
          role="status"
        >
          Saved. These are what the app will open with.
        </p>
      </div>

      <h2 style={{ fontWeight: 700, marginTop: 32 }}>Account</h2>
      <AccountPanel />
    </section>
  );
}
