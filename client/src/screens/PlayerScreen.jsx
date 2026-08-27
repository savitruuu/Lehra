import { useRef } from "react";

import { saFrequencyFor } from "../engine/audio.js";
import { RAAG_LIBRARY } from "../engine/taalData.js";
import { usePlayer } from "../player/PlayerContext.jsx";
import { useUI } from "../ui/UIContext.jsx";
import { Tile } from "../components/Tile.jsx";
import { RangeInput } from "../components/RangeInput.jsx";
import { MandalaRing } from "../components/MandalaRing.jsx";
import { TransportIcon } from "../components/TransportIcon.jsx";
import {
  TAAL_OPTIONS,
  LEHRA_TAAL_OPTIONS,
  INSTRUMENT_OPTIONS,
  PITCH_OPTIONS,
  LAYA_PRESETS,
  TANPURA_STRINGS
} from "../lib/options.js";
import { SWARMANDAL_RAAG_OPTIONS } from "../lib/swarmandalRaags.js";

/**
 * The player: one screen, no scrolling, everything within thumb reach.
 *
 * The pre-build app shipped two layouts in one document and physically moved
 * DOM nodes between them at a media-query boundary of 99999px - which is to say
 * the desktop arrangement had already been switched off, and only the phone one
 * ever rendered. So this renders that arrangement directly. The elements that
 * were being relocated (the fine-tune row, the mixer heads and levels, the
 * lehra's own volume, the laya presets) are simply written where they end up.
 *
 * The ids are kept because style.css addresses several of them by id -
 * `#tile-raag`, `#lehra-volume-slot` and the rest are how tabla accompaniment
 * mode hides what it does not need.
 */
export function PlayerScreen({ active }) {
  return (
    <section className={"screen" + (active ? " active" : "")} id="player-screen">
      <ScaleHero />
      <ControlSections />
      <TanpuraSheet />
      <TransportPanel />
      {/* The three laya presets read as a choice made about the tempo card
          rather than a control inside it, so they sit below it, clear of the
          card's edge. */}
      <div className="laya-slot" id="laya-slot">
        <LayaPresets />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- scale --- */

/** "0" at rest, otherwise signed - "+12" or "-8", never a bare "12". */
function formatCents(c) {
  if (!c) return "0";
  return (c > 0 ? "+" : "") + c;
}

function ScaleHero() {
  const {
    pitch,
    choosePitch,
    stepScale,
    pitchCents,
    setPitchCents,
    commitFineTune
  } = usePlayer();
  const { togglePicker } = useUI();
  const orbRef = useRef(null);

  return (
    <div className="scale-hero-wrap" id="scale-hero-wrap">
      <div className="scale-hero">
        <button
          className="scale-step"
          id="scale-down"
          onClick={() => stepScale(-1)}
          aria-label="Lower the scale by a semitone"
        >
          <MandalaRing petals={12} />
          <svg className="scale-step-arrow" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 16.5 7 8.5H17Z" fill="currentColor" />
          </svg>
        </button>

        {/* Tapping the orb opens the same anchored list as the tiles below - a
            direct pick, alongside the arrows either side of it for a step at a
            time. */}
        <div
          className="scale-orb"
          id="scale-orb"
          ref={orbRef}
          role="button"
          tabIndex={0}
          aria-haspopup="listbox"
          aria-label={`Choose the scale, currently ${pitch}`}
          onClick={() =>
            togglePicker({
              anchor: orbRef.current,
              options: PITCH_OPTIONS,
              value: pitch,
              onSelect: choosePitch
            })
          }
        >
          <MandalaRing petals={24} />
          <div className="scale-note">{pitch}</div>
          {/* Computed from React's own state rather than read back off the
              engine: the engine is written by an effect, which runs after this
              render, so asking it would show the previous scale for a frame. */}
          <div className="scale-freq">
            {saFrequencyFor(pitch, pitchCents).toFixed(1)} Hz
          </div>
          <div className="scale-cents">{formatCents(pitchCents)}</div>
        </div>

        <button
          className="scale-step"
          id="scale-up"
          onClick={() => stepScale(1)}
          aria-label="Raise the scale by a semitone"
        >
          <MandalaRing petals={12} />
          <svg className="scale-step-arrow" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 7.5 17 15.5H7Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Micro scale adjuster: a semitone is a coarse step when matching a
          fixed-pitch instrument or an existing recording, so this bends the
          reference Sa continuously between a flat and a sharp of the selected
          scale. Flat and sharp rather than minus and plus - the slider bends
          the pitch, so the direction is named the way a musician reads it. */}
      <div className="fine-tune-row" id="fine-tune-row">
        <button
          className="fine-tune-step"
          onClick={() => {
            setPitchCents((c) => Math.max(-50, c - 1));
            commitFineTune();
          }}
          aria-label="Flatten the scale by one cent"
        >
          &#9837;
        </button>
        <RangeInput
          min={-50}
          max={50}
          step={1}
          value={pitchCents}
          onChange={setPitchCents}
          onCommit={commitFineTune}
          aria-label="Fine tune the scale"
        />
        <button
          className="fine-tune-step"
          onClick={() => {
            setPitchCents((c) => Math.min(50, c + 1));
            commitFineTune();
          }}
          aria-label="Sharpen the scale by one cent"
        >
          &#9839;
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- controls --- */

/** One instrument's row in the mixer: its transport, its name, its level. */
function MixerCell({ id, name, playing, onToggle, volume, onVolume, extra, headingId, onHeadingClick, chevron, disabled }) {
  return (
    <div className="mixer-cell" id={id}>
      <div className="mix-head">
        <button
          className="btn btn-round mix-play-btn"
          id={`${name.toLowerCase()}-play-btn`}
          onClick={onToggle}
          disabled={disabled}
          aria-label={`${playing ? "Pause" : "Play"} ${name}`}
        >
          <TransportIcon playing={playing} />
        </button>
        <h4
          id={headingId}
          onClick={onHeadingClick}
          style={onHeadingClick ? { cursor: "pointer" } : undefined}
        >
          {name}
          {chevron && (
            <svg className="mix-settings-chevron" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
          )}
        </h4>
      </div>

      <div className="slider-container">
        <div className="slider-header">
          <span className="control-label">Volume</span>
          <span className="slider-val">{volume}%</span>
        </div>
        <RangeInput value={volume} onChange={onVolume} aria-label={`${name} volume`} />
      </div>

      {extra}
    </div>
  );
}

function ControlSections() {
  const {
    taal, setTaal,
    raag, setRaag, raagOptions,
    instrument, setInstrument,
    volumes, setVolume,
    playing, toggleTanpura, toggleMetronome, toggleTabla, toggleSwarmandal, tablaBusy,
    swarmandalRaag, setSwarmandalRaag,
    tablaMode, tablaLoadFailed
  } = usePlayer();
  const { openSheet } = useUI();

  // Theka-only taals are offered only in accompaniment mode: they have no lehra
  // written for their cycle length, so offering them to the lehra player would
  // be offering silence or a fragment of somebody else's line.
  const taalOptions = tablaMode ? TAAL_OPTIONS : LEHRA_TAAL_OPTIONS;

  const tablaCell = (
    <MixerCell
      id={tablaMode ? "mixer-cell-tabla-left" : "mixer-cell-tabla"}
      name="Tabla"
      headingId="tabla-heading"
      playing={playing.tabla}
      onToggle={toggleTabla}
      disabled={tablaBusy}
      volume={volumes.tabla}
      onVolume={(v) => setVolume("tabla", v)}
      extra={
        // Only ever says anything when the recordings could not be loaded.
        // There is no synthesised tabla to fall back to, so silence would
        // otherwise go unexplained.
        tablaLoadFailed ? (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            Tabla recordings could not be loaded - serve the app over http
            rather than opening the file directly.
          </p>
        ) : null
      }
    />
  );

  // Accompaniment-mode only: a plucked-zither flourish the singer can brush in
  // over the theka. It takes the mixer slot the tabla cell vacates when it
  // moves to the left column in this mode; its raag is chosen from the tile in
  // the left column, alongside Taal.
  const swarmandalCell = (
    <MixerCell
      id="mixer-cell-swarmandal"
      name="Swarmandal"
      playing={playing.swarmandal}
      onToggle={toggleSwarmandal}
      volume={volumes.swarmandal}
      onVolume={(v) => setVolume("swarmandal", v)}
    />
  );

  return (
    <div className="control-sections" id="control-sections">
      <div className="control-section" id="picker-section">
        <Tile
          id="tile-instrument"
          label="Instrument"
          options={INSTRUMENT_OPTIONS}
          value={instrument}
          onSelect={setInstrument}
        />
        <Tile
          id="tile-taal"
          label="Taal"
          options={taalOptions}
          value={taal}
          onSelect={setTaal}
        />
        <Tile
          id="tile-raag"
          label="Raag"
          options={raagOptions}
          value={raag}
          onSelect={setRaag}
        />
        {/* Accompaniment mode only (hidden by the stylesheet on the lehra
            player): which raag the swarmandal brushes its aaroh and avaroh in.
            The same anchored picker the lehra's Raag tile uses. */}
        <Tile
          id="tile-swarmandal-raag"
          label="Swarmandal Raag"
          options={SWARMANDAL_RAAG_OPTIONS}
          value={swarmandalRaag}
          onSelect={setSwarmandalRaag}
        />
        {/* In accompaniment mode the tabla's controls move out of the levels
            column and under Taal: with the raag and the instrument gone, this
            column becomes the taal and the drum that plays it, and the right
            column is left for the two things a singer balances against them. */}
        {tablaMode ? tablaCell : <div className="mixer-cell" id="mixer-cell-tabla-left" />}
      </div>

      <div className="control-section" id="mixer-section">
        <MixerCell
          id="mixer-cell-tanpura"
          name="Tanpura"
          headingId="tanpura-heading"
          onHeadingClick={() => openSheet("tanpura")}
          chevron
          playing={playing.tanpura}
          onToggle={toggleTanpura}
          volume={volumes.tanpura}
          onVolume={(v) => setVolume("tanpura", v)}
        />
        <MixerCell
          id="mixer-cell-metronome"
          name="Metronome"
          playing={playing.metronome}
          onToggle={toggleMetronome}
          volume={volumes.metronome}
          onVolume={(v) => setVolume("metronome", v)}
        />
        {tablaMode ? swarmandalCell : tablaCell}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- sheet --- */

/**
 * The tanpura's Speed and First String, one tap behind its heading.
 *
 * Its play button and level are out on the mixer row; what is left here is what
 * a player sets once and leaves alone.
 */
function TanpuraSheet() {
  const {
    tanpuraSpeed, setTanpuraSpeed, commitTanpuraSpeed,
    tanpuraString, chooseTanpuraString,
    tanpuraFallback
  } = usePlayer();
  const { sheet, closeOverlays } = useUI();

  return (
    <div className={"mix-section mix-sheet" + (sheet === "tanpura" ? " open" : "")}>
      <div className="sheet-handle" onClick={() => closeOverlays()} />

      {/* Only worth saying something when the recording is NOT what's playing. */}
      {tanpuraFallback && (
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          No recording for this tuning — using the synthesised tanpura.
        </p>
      )}

      <div className="slider-container">
        <div className="slider-header">
          <span className="control-label">Speed</span>
          <span className="slider-val">{tanpuraSpeed}%</span>
        </div>
        <RangeInput
          min={60}
          max={160}
          step={5}
          value={tanpuraSpeed}
          onChange={setTanpuraSpeed}
          onCommit={commitTanpuraSpeed}
          aria-label="Tanpura speed"
        />
      </div>

      {/* Accompaniment mode only - the stylesheet hides it elsewhere. On the
          lehra player the raag is picked on screen and every lehra this app
          ships keeps its Pa, so the choice would be a control that exists to be
          left alone; in accompaniment mode there is no raag on screen at all
          and what the singer is singing is the only thing that decides it. */}
      <div className="tanpura-string-row" id="tanpura-string-row">
        <span className="control-label">First String</span>
        <div className="btn-group tanpura-string-group" role="group" aria-label="Tanpura first string">
          {TANPURA_STRINGS.map((s) => (
            <button
              key={s.type}
              className={"btn" + (tanpuraString === s.type ? " active" : "")}
              type="button"
              aria-pressed={tanpuraString === s.type}
              onClick={() => chooseTanpuraString(s.type)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ transport --- */

function TransportPanel() {
  const {
    bpm, setBpm,
    taalDef, raag, instrument, pitch,
    playing, togglePrimary, tablaMode, tablaBusy,
    volumes, setVolume
  } = usePlayer();

  const what = tablaMode ? "Tabla" : "Lehra";
  const isPlaying = tablaMode ? playing.tabla : playing.lehra;

  let laya = "Madhya Laya";
  if (bpm < 90) laya = "Vilambit Laya";
  else if (bpm > 180) laya = "Dhrut Laya";

  const raagName = RAAG_LIBRARY[raag]?.name ?? raag;
  const instrumentName =
    INSTRUMENT_OPTIONS.find((i) => i.value === instrument)?.label ?? instrument;

  return (
    <div className="glass-panel transport-panel">
      <div className="transport-row">
        <div className="transport-main">
          <button
            className={"main-play-btn" + (isPlaying ? " playing" : "")}
            id="play-btn"
            onClick={togglePrimary}
            disabled={tablaBusy}
            aria-label={`${isPlaying ? "Pause" : "Play"} ${what}`}
          >
            <TransportIcon playing={isPlaying} />
          </button>
          <div className="transport-status">
            <h4>{`${raagName} – ${taalDef.name}`}</h4>
            <p>{`${instrumentName} • Scale ${pitch} • ${laya}`}</p>
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: "1px solid var(--panel-border)", margin: 0 }} />

      {/* The card is named for what its button does, not for the quantity
          beside it - the BPM readout already says "tempo" in the only terms
          that matter. */}
      <div className="slider-header">
        <span className="control-label" style={{ fontSize: 16 }}>Play {what}</span>
        <span className="slider-val" style={{ fontSize: 24 }}>{bpm} BPM</span>
      </div>

      {/* Halve and double sit at the ends because they are the coarse moves: a
          lehra is practised at half and at double the laya it was learnt at, so
          those two are one tap rather than forty on -5. */}
      {/* The ids matter: the narrowest breakpoint drops halve and double by id,
          which is what buys back the width the tempo track needs on a 360px
          handset. */}
      <div className="tempo-row">
        <button id="bpm-half" className="btn btn-round bpm-step bpm-step-sm" onClick={() => setBpm(bpm / 2)} aria-label="Halve the tempo">&frac12;x</button>
        <button id="bpm-minus-5" className="btn btn-round bpm-step bpm-step-sm" onClick={() => setBpm(bpm - 5)} aria-label="Five BPM slower">-5</button>
        <button id="bpm-minus" className="btn btn-round bpm-step" onClick={() => setBpm(bpm - 1)} aria-label="One BPM slower">-</button>
        <RangeInput min={30} max={400} value={bpm} onChange={setBpm} aria-label="Tempo in BPM" />
        <button id="bpm-plus" className="btn btn-round bpm-step" onClick={() => setBpm(bpm + 1)} aria-label="One BPM faster">+</button>
        <button id="bpm-plus-5" className="btn btn-round bpm-step bpm-step-sm" onClick={() => setBpm(bpm + 5)} aria-label="Five BPM faster">+5</button>
        <button id="bpm-double" className="btn btn-round bpm-step bpm-step-sm" onClick={() => setBpm(bpm * 2)} aria-label="Double the tempo">2x</button>
      </div>

      {/* The lehra's own level, right under the tempo it belongs with. No play
          button of its own - the main Play button already covers it. */}
      <div className="lehra-volume-slot" id="lehra-volume-slot">
        <div className="slider-container" id="lehra-volume-block">
          <div className="slider-header">
            <span className="control-label">Lehra Volume</span>
            <span className="slider-val">{volumes.lehra}%</span>
          </div>
          <RangeInput
            value={volumes.lehra}
            onChange={(v) => setVolume("lehra", v)}
            aria-label="Lehra volume"
          />
        </div>
      </div>
    </div>
  );
}

function LayaPresets() {
  const { bpm, setBpm } = usePlayer();

  return (
    <div className="laya-timer-row" id="laya-timer-row">
      {/* The bracketed BPM is what makes these a scale rather than three opaque
          names, so it is shown at every width. Whichever button matches the
          current tempo is filled. */}
      <div className="btn-group laya-group">
        {LAYA_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={"btn" + (bpm === preset.bpm ? " active" : "")}
            onClick={() => setBpm(preset.bpm)}
          >
            {preset.label}
            <span className="laya-bpm">({preset.bpm})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
