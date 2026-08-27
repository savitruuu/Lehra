import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback
} from "react";

import { AudioEngine, mixGain } from "../engine/audio.js";
import { TAAL_DATA } from "../engine/taalData.js";
import { savePracticeSession } from "../lib/practiceLog.js";
import { loadSettings } from "../lib/settings.js";
import { raagOptionsForTaal, SCALE_STEP_ORDER } from "../lib/options.js";
import {
  DEFAULT_SWARMANDAL_RAAG,
  swarmandalRaagByKey
} from "../lib/swarmandalRaags.js";

/**
 * The bridge between React and the audio engine.
 *
 * The engine is a long-lived imperative singleton holding an AudioContext, a
 * lookahead scheduler and a pile of live audio nodes - none of which can be
 * rebuilt on a re-render. So it stays exactly as it was, and this module owns
 * the mirror: React state drives what is on screen, effects push each change
 * down into the engine, and the engine's beat callback pushes back up.
 *
 * The one rule that keeps it honest: a value is either React state or engine
 * state, never both as the source of truth. Everything the user can change is
 * state here and is written to the engine by an effect. Everything the engine
 * decides (which matra is sounding, whether a sample loaded) is read from it.
 */
const PlayerContext = createContext(null);

const SCREENSAVER_DELAY_MS = 30000;
const MIN_BPM = 30;
const MAX_BPM = 400;

// Tanpura pluck spacing as a percentage of the recording's own pace: lower is
// slower, more spaced-out plucks. setTanpuraTempo takes 100 / this. Now that
// every scale plucks at exactly this pace (the resample-speed compensation in
// audio.js), 70 sits a touch slower than the old ~80 that only some scales hit.
const DEFAULT_TANPURA_SPEED = 70;

export function PlayerProvider({ children }) {
  const saved = useMemo(() => loadSettings(), []);

  // --- What the user has chosen -------------------------------------------
  const [taal, setTaal] = useState(saved.taal);
  const [raag, setRaag] = useState(saved.raag);
  const [instrument, setInstrument] = useState(saved.instrument);
  const [pitch, setPitch] = useState(saved.pitch);
  const [pitchCents, setPitchCents] = useState(0);
  const [bpm, setBpmState] = useState(() => {
    const savedBpm = Number(saved.bpm);
    return Number.isFinite(savedBpm)
      ? Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(savedBpm)))
      : 120;
  });

  const [volumes, setVolumes] = useState({
    lehra: 70,
    tanpura: 70,
    metronome: 70,
    tabla: 70,
    swarmandal: 50
  });
  const [tanpuraSpeed, setTanpuraSpeed] = useState(DEFAULT_TANPURA_SPEED);
  const [tanpuraString, setTanpuraString] = useState("pa");
  const [swarmandalRaag, setSwarmandalRaag] = useState(DEFAULT_SWARMANDAL_RAAG);

  // --- What is currently sounding -----------------------------------------
  const [playing, setPlaying] = useState({
    lehra: false,
    tanpura: false,
    metronome: false,
    tabla: false,
    swarmandal: false
  });
  const [tablaMode, setTablaModeState] = useState(false);
  const [tablaBusy, setTablaBusy] = useState(false);

  // --- Readouts ------------------------------------------------------------
  const [beat, setBeat] = useState({ matraNumber: 1, bol: "", vibhaag: 0 });
  const [samPulse, setSamPulse] = useState(false);
  const [avartanCount, setAvartanCount] = useState(0);
  const [practiceSeconds, setPracticeSeconds] = useState(0);
  const [screensaverOn, setScreensaverOn] = useState(false);
  const [tanpuraFallback, setTanpuraFallback] = useState(false);
  const [tablaLoadFailed, setTablaLoadFailed] = useState(false);

  /**
   * Where the avartan tracker is, kept in refs rather than state.
   *
   * The ring is redrawn every frame and needs sub-matra precision; the matra
   * number on screen only changes once per beat. Putting the interpolation
   * inputs in state would re-render the whole player up to ~7 times a second at
   * drut laya for a number that has not changed.
   */
  const lastBeatIndexRef = useRef(0);
  const lastBeatAtRef = useRef(0);
  const avartanSamsRef = useRef(0);
  const practiceRef = useRef(0);
  const practiceTimerRef = useRef(null);
  const screensaverTimerRef = useRef(null);
  const transportWasRunningRef = useRef(false);
  const instrumentTokenRef = useRef(0);

  const transportRunning =
    playing.lehra || playing.metronome || playing.tabla;

  // --- Engine wiring -------------------------------------------------------

  /**
   * One-time setup. The preloads are deliberately not awaited: they only need
   * to finish sometime before Play is first pressed, and blocking the first
   * paint on 7MB of mp3 would be a worse trade than a synthesised first beat in
   * the rare case somebody is quicker than the network.
   */
  useEffect(() => {
    AudioEngine.preloadTanpuraSamples();
    AudioEngine.preloadTablaSamples();
    AudioEngine.preloadInstrument(saved.instrument);
    AudioEngine.loadSwarmandalSample();

    AudioEngine.tanpuraDroneType = "pa";
    AudioEngine.setTanpuraTempo(100 / DEFAULT_TANPURA_SPEED);

    // Lets the tempo readout settle once a background stretch has landed.
    AudioEngine.onTanpuraStretchEnd = () => {};

    return () => {
      AudioEngine.onBeatCallback = null;
      AudioEngine.onTanpuraStretchEnd = null;
    };
  }, [saved.instrument]);

  // Push each choice down into the engine. Separate effects rather than one
  // that depends on everything, so changing the tempo does not also rewrite the
  // taal key and reset the matra index.
  useEffect(() => {
    AudioEngine.activeTaalKey = taal;
  }, [taal]);

  useEffect(() => {
    window._activeRaagKey = raag;
    // A new line starts at the top of the cycle rather than wherever the old
    // one had got to.
    AudioEngine.currentMatraIndex = 0;
  }, [raag]);

  useEffect(() => {
    AudioEngine.bpm = bpm;
  }, [bpm]);

  useEffect(() => {
    const r = swarmandalRaagByKey(swarmandalRaag);
    AudioEngine.setSwarmandalRaag(r.aaroh, r.avaroh, r.pakad, r.pakad2);
  }, [swarmandalRaag]);

  useEffect(() => {
    AudioEngine.pitch = pitch;
    AudioEngine.retuneTanpura();
  }, [pitch]);

  useEffect(() => {
    AudioEngine.pitchCents = pitchCents;
  }, [pitchCents]);

  /**
   * Switching instrument waits for that instrument's recordings.
   *
   * Assigning AudioEngine.instrument the moment the picker changed used to
   * leave a gap in which playSampled found nothing decoded under the new key
   * and fell through to the synthesised voice - so every switch announced
   * itself with a beat or two of something that sounds nothing like the
   * instrument being chosen. Holding the previous instrument until the new one
   * is playable is the fix; the token guards against a quick second pick
   * landing behind a slower first one.
   */
  useEffect(() => {
    const token = ++instrumentTokenRef.current;
    let cancelled = false;

    AudioEngine.preloadInstrument(instrument).then(() => {
      if (cancelled || token !== instrumentTokenRef.current) return;
      AudioEngine.instrument = instrument;
    });

    return () => {
      cancelled = true;
    };
  }, [instrument]);

  /** Applies one bus's level to its gain node, if the graph exists yet. */
  const applyVolume = useCallback((bus, percent) => {
    const nodeName = {
      lehra: "lehraGain",
      tanpura: "droneGain",
      metronome: "metronomeGain",
      tabla: "tablaGain",
      swarmandal: "swarmandalGain"
    }[bus];

    const node = AudioEngine[nodeName];
    if (!node || !AudioEngine.ctx) return;
    node.gain.setValueAtTime(mixGain(bus, percent), AudioEngine.ctx.currentTime);
  }, []);

  // The gain nodes do not exist until the engine's first init(), which happens
  // on the first transport start - so this both applies live changes and
  // re-applies everything once the graph appears.
  useEffect(() => {
    Object.entries(volumes).forEach(([bus, percent]) => applyVolume(bus, percent));
  }, [volumes, applyVolume, playing]);

  /**
   * The beat callback. Fires on the audio thread's schedule, once per matra.
   */
  useEffect(() => {
    AudioEngine.onBeatCallback = (matraIndex) => {
      const taalDef = TAAL_DATA[AudioEngine.activeTaalKey];
      if (!taalDef) return;

      lastBeatIndexRef.current = matraIndex;
      lastBeatAtRef.current = performance.now();

      const matraNumber = matraIndex + 1;

      if (matraNumber === 1) {
        // Sam is where the avartan count ticks over. Counted off Sams rather
        // than incremented directly: the first Sam of a run opens the first
        // cycle instead of completing one, so completed avartans are always one
        // behind the Sams seen - which makes the reading during the first cycle
        // 0 rather than 1, as "cycles so far" should say.
        avartanSamsRef.current += 1;
        setAvartanCount(Math.max(0, avartanSamsRef.current - 1));

        setSamPulse(true);
        setTimeout(() => setSamPulse(false), 300);
      }

      setBeat({
        matraNumber,
        // Only the tabla bol. Sam, tali and khali are already carried by the
        // vibhaag markers, so repeating them would just be noise.
        bol: (taalDef.theka && taalDef.theka[matraIndex]) || "",
        vibhaag: vibhaagIndexForMatra(taalDef, matraNumber)
      });
    };

    return () => {
      AudioEngine.onBeatCallback = null;
    };
  }, []);

  // --- Practice clock ------------------------------------------------------

  /**
   * Writes what the clock has counted so far to the practice log and zeroes it.
   *
   * Separate from stopping the transport because the screensaver's Reset button
   * needs the same thing without stopping anything: the count is what the
   * Analytics screen reads, so resetting the readout has to bank the stretch it
   * is throwing away rather than lose that practice time. The log is
   * append-only, so a reset mid-session simply lands as two entries.
   */
  const bankPracticeSeconds = useCallback(() => {
    // Anything under five seconds is a mis-tap, not a session.
    if (practiceRef.current > 5) {
      savePracticeSession(
        practiceRef.current,
        AudioEngine.activeTaalKey,
        AudioEngine.bpm,
        AudioEngine.instrument
      );
    }
    practiceRef.current = 0;
    setPracticeSeconds(0);
  }, []);

  const startPracticeClock = useCallback(() => {
    practiceRef.current = 0;
    setPracticeSeconds(0);
    clearInterval(practiceTimerRef.current);
    practiceTimerRef.current = setInterval(() => {
      practiceRef.current += 1;
      setPracticeSeconds(practiceRef.current);
    }, 1000);
  }, []);

  const stopPracticeClock = useCallback(() => {
    clearInterval(practiceTimerRef.current);
    practiceTimerRef.current = null;
    bankPracticeSeconds();
  }, [bankPracticeSeconds]);

  useEffect(() => () => clearInterval(practiceTimerRef.current), []);

  // --- Screensaver ---------------------------------------------------------

  /**
   * Restarts the countdown to the screensaver.
   *
   * Called on any transport change and on any touch or key, so the countdown
   * measures playing that the user has left alone - the graphic never takes
   * over while a slider is still being dragged.
   */
  const noteActivity = useCallback(() => {
    clearTimeout(screensaverTimerRef.current);
    setScreensaverOn(false);

    if (!transportRunning) return;
    screensaverTimerRef.current = setTimeout(() => {
      setScreensaverOn(true);
    }, SCREENSAVER_DELAY_MS);
  }, [transportRunning]);

  // The standstill -> running edge is also where the scheduler restarts at
  // matra 0 (see _ensureSchedulerRunning in audio.js), so the avartan count and
  // the matra clock always begin together. Adding the tabla or the click to
  // something already running leaves the count alone.
  //
  // The session clock hangs off the same edge, and for the same reason it has
  // to: transportRunning is lehra OR click OR tabla, so anything that can put
  // the screensaver on screen must also be able to start the clock behind it.
  // Driving it from the individual buttons instead left the tabla's own button
  // and the metronome starting a session the clock never counted - the
  // screensaver would take over and sit at 0:00.
  useEffect(() => {
    const wasRunning = transportWasRunningRef.current;
    if (transportRunning && !wasRunning) {
      avartanSamsRef.current = 0;
      setAvartanCount(0);
      startPracticeClock();
    } else if (!transportRunning && wasRunning) {
      // Banks the stretch to the practice log on the way down.
      stopPracticeClock();
    }
    transportWasRunningRef.current = transportRunning;
    noteActivity();
  }, [transportRunning, noteActivity, startPracticeClock, stopPracticeClock]);

  useEffect(() => () => clearTimeout(screensaverTimerRef.current), []);

  // --- Transport commands --------------------------------------------------

  const syncPlaying = useCallback(() => {
    setPlaying({
      lehra: AudioEngine.isPlaying,
      tanpura: AudioEngine.tanpuraPlaying,
      metronome: AudioEngine.metronomeIsPlaying,
      tabla: AudioEngine.tablaIsPlaying,
      swarmandal: AudioEngine.swarmandalPlaying
    });
  }, []);

  const toggleLehra = useCallback(() => {
    if (AudioEngine.isPlaying) {
      // The tanpura is independent - it keeps droning unless the user stops it
      // from its own button.
      AudioEngine.stop();
    } else {
      AudioEngine.start();
    }
    syncPlaying();
  }, [syncPlaying]);

  const toggleTabla = useCallback(async () => {
    if (AudioEngine.tablaIsPlaying) {
      AudioEngine.stopTabla();
      syncPlaying();
      return;
    }
    // Starting waits on the recordings, which are normally already warm from
    // the preload at boot. Disable the button rather than let a second press
    // queue a second start behind the first.
    setTablaBusy(true);
    const started = await AudioEngine.startTabla();
    setTablaBusy(false);
    setTablaLoadFailed(!started);
    syncPlaying();
  }, [syncPlaying]);

  const toggleTanpura = useCallback(async () => {
    if (AudioEngine.tanpuraPlaying) {
      AudioEngine.stopTanpura();
    } else {
      await AudioEngine.startTanpura();
      applyVolume("tanpura", volumes.tanpura);
    }
    setTanpuraFallback(
      AudioEngine.tanpuraPlaying && !AudioEngine.usingSampledTanpura
    );
    syncPlaying();
  }, [applyVolume, syncPlaying, volumes.tanpura]);

  const toggleMetronome = useCallback(() => {
    if (AudioEngine.metronomeIsPlaying) AudioEngine.stopMetronome();
    else AudioEngine.startMetronome();
    syncPlaying();
  }, [syncPlaying]);

  const toggleSwarmandal = useCallback(async () => {
    if (AudioEngine.swarmandalPlaying) {
      // Pause the swarmandal only - the tanpura it started keeps droning, the
      // same way stopping the lehra leaves the tanpura on.
      AudioEngine.stopSwarmandal();
    } else {
      AudioEngine.startSwarmandal();
      applyVolume("swarmandal", volumes.swarmandal);
      // A swarmandal flourish sits on top of a drone - start the tanpura with
      // it if it is not already running.
      if (!AudioEngine.tanpuraPlaying) {
        await AudioEngine.startTanpura();
        applyVolume("tanpura", volumes.tanpura);
        setTanpuraFallback(
          AudioEngine.tanpuraPlaying && !AudioEngine.usingSampledTanpura
        );
      }
    }
    syncPlaying();
  }, [applyVolume, syncPlaying, volumes.swarmandal, volumes.tanpura]);

  /**
   * The main transport button. In accompaniment mode it drives the theka rather
   * than the lehra - there is no lehra to start there, and the tabla's own
   * button is hidden precisely so this is the only one.
   */
  const togglePrimary = useCallback(async () => {
    if (tablaMode) {
      if (AudioEngine.tablaIsPlaying) {
        AudioEngine.stopTabla();
        syncPlaying();
      } else {
        setTablaBusy(true);
        const started = await AudioEngine.startTabla();
        setTablaBusy(false);
        setTablaLoadFailed(!started);
        syncPlaying();
      }
      return;
    }
    toggleLehra();
  }, [tablaMode, toggleLehra, syncPlaying]);

  /** Stops every transport at once - lehra, tanpura, metronome, tabla, swarmandal. */
  const stopAllTransports = useCallback(() => {
    if (AudioEngine.isPlaying) AudioEngine.stop();
    if (AudioEngine.tanpuraPlaying) AudioEngine.stopTanpura();
    if (AudioEngine.metronomeIsPlaying) AudioEngine.stopMetronome();
    if (AudioEngine.tablaIsPlaying) AudioEngine.stopTabla();
    if (AudioEngine.swarmandalPlaying) AudioEngine.stopSwarmandal();
    setTanpuraFallback(false);
    syncPlaying();
  }, [syncPlaying]);

  /**
   * Crossing into or out of accompaniment mode.
   *
   * Silence first, in both directions: this is a change of what the player is
   * for, not a change of what is playing.
   */
  const setTablaMode = useCallback(
    (on) => {
      setTablaModeState((was) => {
        if (was === on) return was;
        stopAllTransports();

        if (!on) {
          // A theka-only taal has to go back to one the lehra player can
          // actually play - otherwise the taal tile would be left reading Dadra
          // on a screen whose melody has no Dadra to play.
          setTaal((current) =>
            TAAL_DATA[current]?.thekaOnly ? "teentaal" : current
          );
          // Same reasoning for the drone's first string: its buttons live in
          // the tanpura sheet and are hidden outside accompaniment mode, so a
          // Sa-Ma left behind would be a tuning in effect with nothing on
          // screen to change it.
          setTanpuraString("pa");
          AudioEngine.tanpuraDroneType = "pa";
        }
        return on;
      });
      document.body.classList.toggle("tabla-mode", on);
    },
    [stopAllTransports]
  );

  // --- Setters the UI calls ------------------------------------------------

  const setBpm = useCallback((value) => {
    setBpmState(Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value))));
  }, []);

  const setVolume = useCallback((bus, percent) => {
    setVolumes((v) => ({ ...v, [bus]: percent }));
  }, []);

  /**
   * Moves the scale a semitone. Clamps at either end of SCALE_STEP_ORDER rather
   * than wrapping - past F# the up button simply stops doing anything, and
   * likewise for down past G.
   */
  const stepScale = useCallback((delta) => {
    setPitch((current) => {
      const index = SCALE_STEP_ORDER.indexOf(current);
      if (index < 0) return current;
      const next = Math.max(
        0,
        Math.min(SCALE_STEP_ORDER.length - 1, index + delta)
      );
      return SCALE_STEP_ORDER[next];
    });
    // A new scale starts centred - any fine-tune bend belonged to the scale
    // just left, not to this one.
    setPitchCents(0);
  }, []);

  const choosePitch = useCallback((value) => {
    setPitch(value);
    setPitchCents(0);
  }, []);

  /** Commits a fine-tune change: the sampled drone has to be rebuilt for it. */
  const commitFineTune = useCallback(() => {
    AudioEngine.retuneTanpura();
  }, []);

  const chooseTanpuraString = useCallback(
    async (type) => {
      if (AudioEngine.tanpuraDroneType === type) return;

      // Marked before the await, not after: setTanpuraType restarts a running
      // drone, which means loading and stretching the other recording, and the
      // buttons should show what was pressed straight away rather than after
      // it.
      AudioEngine.tanpuraDroneType = type;
      setTanpuraString(type);

      await AudioEngine.setTanpuraType(type);

      // A restart builds the drone again from the sample, so its level is
      // reapplied the same way the play button does it.
      if (AudioEngine.tanpuraPlaying) applyVolume("tanpura", volumes.tanpura);
      setTanpuraFallback(
        AudioEngine.tanpuraPlaying && !AudioEngine.usingSampledTanpura
      );
    },
    [applyVolume, volumes.tanpura]
  );

  /**
   * Applied on release rather than on every input event: a tempo change may
   * need to build a new time-stretched buffer, which is too heavy to redo
   * continuously mid-drag. The build itself runs in a background Worker, so it
   * does not block the UI or the currently-playing audio either way.
   */
  const commitTanpuraSpeed = useCallback(
    (percent) => {
      AudioEngine.setTanpuraTempo(100 / percent);
      applyVolume("tanpura", volumes.tanpura);
    },
    [applyVolume, volumes.tanpura]
  );

  /**
   * The screensaver's Reset button: sets the session clock back to 0:00 and
   * starts the avartan count again from where the player is now, without
   * touching the transport. For the common case of leaving the lehra running
   * between two stretches of riyaaz, which otherwise reads as one long session.
   */
  const resetSessionClock = useCallback(() => {
    bankPracticeSeconds();
    avartanSamsRef.current = 0;
    setAvartanCount(0);
  }, [bankPracticeSeconds]);

  // --- Derived -------------------------------------------------------------

  const raagOptions = useMemo(() => raagOptionsForTaal(taal), [taal]);

  // A raag with no line for this taal's cycle length is genuinely unplayable
  // here, so the first available one takes over.
  useEffect(() => {
    if (raagOptions.length && !raagOptions.some((o) => o.value === raag)) {
      setRaag(raagOptions[0].value);
    }
  }, [raagOptions, raag]);

  const taalDef = TAAL_DATA[taal] ?? TAAL_DATA.teentaal;

  /**
   * Where the avartan tracker is, as a fractional matra index.
   *
   * The scheduler only calls back once per matra, which is enough to move a
   * number but not to sweep an arc, so the wall clock fills in between: each
   * callback stamps the moment it landed and this interpolates from there at
   * the current tempo.
   */
  const avartanPosition = useCallback(() => {
    const matras = TAAL_DATA[AudioEngine.activeTaalKey]?.matras ?? 16;
    const index = lastBeatIndexRef.current % matras;
    if (!transportRunning || !lastBeatAtRef.current) return index;

    const beatDuration = 60 / AudioEngine.bpm;
    const elapsed = (performance.now() - lastBeatAtRef.current) / 1000;

    // Clamped rather than allowed to run on: if the tab is throttled or a beat
    // callback is late, the arc waits at the matra it last knew about instead
    // of sprinting ahead of the tabla and then snapping back.
    return index + Math.max(0, Math.min(1, elapsed / beatDuration));
  }, [transportRunning]);

  const value = {
    // choices
    taal, setTaal,
    raag, setRaag, raagOptions,
    instrument, setInstrument,
    pitch, choosePitch, stepScale,
    pitchCents, setPitchCents, commitFineTune,
    bpm, setBpm,
    volumes, setVolume,
    tanpuraSpeed, setTanpuraSpeed, commitTanpuraSpeed,
    tanpuraString, chooseTanpuraString,
    swarmandalRaag, setSwarmandalRaag,

    // transport
    playing, transportRunning, tablaBusy,
    togglePrimary, toggleLehra, toggleTabla, toggleTanpura, toggleMetronome,
    toggleSwarmandal,
    tablaMode, setTablaMode,

    // readouts
    beat, samPulse, avartanCount, practiceSeconds,
    taalDef, avartanPosition,
    tanpuraFallback, tablaLoadFailed,

    // screensaver
    screensaverOn, noteActivity, resetSessionClock
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

/** Which vibhaag a given matra falls inside. */
export function vibhaagIndexForMatra(taal, matraNumber) {
  let acc = 0;
  for (let i = 0; i < taal.vibhaags.length; i++) {
    acc += taal.vibhaags[i];
    if (matraNumber <= acc) return i;
  }
  return taal.vibhaags.length - 1;
}

/** First matra of a vibhaag, 1-indexed - the matra its tali or khali falls on. */
export function vibhaagStartMatra(taal, vibhaagIndex) {
  let matra = 1;
  for (let i = 0; i < vibhaagIndex; i++) matra += taal.vibhaags[i];
  return matra;
}

/**
 * The sign shown for the matra that opens a vibhaag:
 *   X  Sam, the first beat of the cycle
 *   0  Khali, the open-hand wave
 *   n  a tali (clap), labelled with the matra it lands on rather than with
 *      which tali it is - so Teentaal reads X 5 0 13, not X 2 0 3.
 */
export function vibhaagSign(taal, matraNumber) {
  if (matraNumber === 1) return "X";
  if (taal.khali_positions.includes(matraNumber)) return "0";
  if (taal.tali_positions.includes(matraNumber)) return String(matraNumber);
  return "-";
}
