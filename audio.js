/**
 * Lehra Web Audio Engine
 * Handles precise scheduling of Lehra notes, Tanpura plucks, and metronome clicks.
 */

/**
 * TANPURA SAMPLES
 *
 * Recordings by Sankalp Gulati (CompMusic project), captured at Dhrupad Sansar,
 * IIT Bombay. Licensed CC BY 4.0 - see the credit line in the Settings screen.
 *
 * They differ in the tuning of the first string, which is raag-dependent:
 *   pa SA SA sa -> the standard tuning, used for most raags
 *   ma SA SA sa -> for raags where Ma dominates or Pa is absent (Malkauns, Bageshri, Lalit)
 * The Ni tuning (Marwa, Puriya, Sohani, Poorvi) has no recording available and
 * falls back to the synthesised engine below.
 *
 * TONIC: the filenames say 233 Hz and the code trusted that, but the recordings
 * do not sit there. The playback rate is worked out as (target Sa / this
 * number), so the error landed directly on the drone: it was sounding about 17
 * cents sharp against every lehra instrument, at every scale. These are
 * recordings of a real instrument tuned to a singer rather than to concert
 * pitch, so there was never a reason for it to be exactly 233.
 *
 * 235.45 is measured, not nominal. Three of the four strings sound Sa at
 * slightly different tunings, so there is no single frequency to find - reading
 * whichever partial is loudest gives answers spread over about ten cents. This
 * figure is the power-weighted centre of the Sa cluster and of the octave above
 * it, averaged over six windows of both files, which is what the ear settles
 * on. The two recordings agree to within half a cent. Treat it as accurate to
 * roughly +/- 2 cents; that is the instrument's own spread, not slack in the
 * measurement. Filenames left alone - only this figure is used.
 */
const TANPURA_SAMPLES = {
  pa: { url: "audio/tanpura-pa-233.mp3", sourceSaHz: 235.45 },
  ma: { url: "audio/tanpura-ma-233.mp3", sourceSaHz: 235.45 }
};

/*
 * Both recordings were measured (see the RMS envelope check in the notes): they
 * are continuously sounding from the first block to the last, with no silence at
 * either end. So the loop uses effectively the whole file and only trims a hair
 * off each edge to dodge MP3 encoder padding.
 */
const TANPURA_EDGE_TRIM = 0.05;   // seconds shaved off each end of the file
const TANPURA_CROSSFADE = 2.0;    // equal-power overlap between loop cycles
const TANPURA_RESTART_FADE = 0.3; // quick crossfade when tempo/tuning changes

/*
 * Equal-power crossfade curves.
 *
 * These replace exponentialRampToValueAtTime, which was the cause of two
 * separate audible faults. Ramping exponentially between 0.0001 and 1.0 is an
 * 80 dB sweep, so halfway through a crossfade BOTH the outgoing and incoming
 * source sit at about 0.01 - roughly -40 dB - and the drone dropped out almost
 * completely on every loop transition. The same curve on the opening fade made
 * the tanpura appear to start with two seconds of silence.
 *
 * sin/cos satisfy sin^2 + cos^2 = 1, so power stays constant across the overlap.
 */
const TANPURA_CURVE_POINTS = 128;
const TANPURA_FADE_IN_CURVE = new Float32Array(TANPURA_CURVE_POINTS);
const TANPURA_FADE_OUT_CURVE = new Float32Array(TANPURA_CURVE_POINTS);
for (let i = 0; i < TANPURA_CURVE_POINTS; i++) {
  const t = i / (TANPURA_CURVE_POINTS - 1);
  TANPURA_FADE_IN_CURVE[i] = Math.sin((t * Math.PI) / 2);
  TANPURA_FADE_OUT_CURVE[i] = Math.cos((t * Math.PI) / 2);
}

/**
 * MIX BALANCE
 *
 * Every volume slider runs 0-100 and multiplies its bus by `scale`, so a slider
 * at MIX_DEFAULT_PERCENT gives the balanced mix below. All four sliders sit at
 * the same default for exactly that reason: level them and you are back to the
 * reference balance, whatever you have been adjusting.
 *
 * The scales are measured rather than chosen. Each bus was rendered offline -
 * the lehra playing its line, the tanpura drone, the theka, the click - and
 * read with gated A-weighted loudness, then trimmed to these targets:
 *
 *     lehra       0 dB    the melodic reference everything else is set against
 *     tabla       0 dB    an equal partner; you practise against it, not under it
 *     metronome  -2 dB    has to cut through both, but it is a cue, not a voice
 *     tanpura    -7 dB    a bed - present, never masking
 *
 * The gate matters for the click. Ungated RMS averages a 50 ms tick over a
 * 500 ms beat, most of which is silence, so the metronome measured 11 dB below
 * the lehra while sounding much closer than that - and setting it by that
 * figure would have made it painfully loud. Measuring only the blocks where a
 * source is actually sounding is what the ear does.
 */
const MIX_DEFAULT_PERCENT = 70;
const MIX = {
  lehra:     { scale: 1.00 },
  tanpura:   { scale: 0.45 },
  metronome: { scale: 4.85 },
  tabla:     { scale: 2.89 }
};

/** The gain a bus sits at when its slider is at `percent`. */
function mixGain(bus, percent) {
  const entry = MIX[bus];
  return entry ? (percent / 100) * entry.scale : percent / 100;
}

class LehraAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.metronomeIsPlaying = false;
    this.tablaIsPlaying = false;
    this._schedulerRunning = false;

    // Audio nodes
    this.masterGain = null;
    this.lehraGain = null;
    this.lehraLimiter = null;
    this.droneGain = null;
    this.metronomeGain = null;
    this.tablaGain = null;
    this.tablaLimiter = null;

    // Scheduler state
    this.bpm = 120;
    this._pitch = "C#"; // Base note
    this._pitchCents = 0;
    this.instrument = "harmonium";
    this.activeTaalKey = "teentaal";
    this.tanpuraDroneType = "pa"; // 'pa', 'ma', 'ni'
    // The metronome is always a taal-aware click; volume is the only control.

    this.currentMatraIndex = 0; // 0-indexed matra in loop
    this.nextNoteTime = 0.0;
    this.lookahead = 25.0; // ms
    this.scheduleAheadTime = 0.1; // seconds
    this.timerId = null;

    // Tanpura state - started and stopped alongside lehra playback
    this.tanpuraPlaying = false;
    this.droneTimerId = null;
    this.nextPluckTime = 0.0;
    this.currentStringIndex = 0; // 0 to 3
    this.droneInterval = 1.6; // base seconds between plucks (humanised per pluck)

    // 1.0 = the recording's own pace. Below 1 plucks faster, above 1 slower.
    this.tanpuraTempo = 1.0;

    // Sampled tanpura state
    this.tanpuraBuffers = {};        // { pa: AudioBuffer, ma: AudioBuffer }
    this.stretchedBuffers = {};      // time-stretched variants, keyed type_tempo
    this.tanpuraLoadFailed = {};     // { pa: true } once a fetch has failed
    this.tanpuraSources = [];        // active crossfading BufferSourceNodes
    this.tanpuraNodes = [];          // synth oscillators, kept out of activeOscillators
    this.nextCycleTime = 0.0;
    this.cycleTimerId = null;
    this.usingSampledTanpura = false;
    this._pendingFadeIn = 0;   // fade for the next scheduled pass; 0 = instant

    // Off-main-thread stretch worker. All WSOLA computation happens here so it
    // never blocks the scheduler that keeps the lehra and metronome running.
    this.stretchWorker = null;
    this._stretchSeq = 0;
    this._stretchPending = new Map();
    this._tempoRequestToken = 0;

    // Fired once a background tempo stretch has landed, so the UI can settle
    // the slider readout. Deliberately no "start" hook - the stretch runs off
    // the main thread with the drone still playing, so there is nothing for
    // the user to wait on and no progress text to show.
    this.onTanpuraStretchEnd = null;

    // Recorded lehra instruments. Falls back to the oscillator voices below
    // if the sample files cannot be loaded.
    this.sampler = new InstrumentSampler();

    // Recorded tabla. Unlike the lehra there is no synthesised fallback - a
    // theka built from oscillators is not worth practising against, so the
    // tabla simply stays silent if the recordings cannot be loaded.
    this.tabla = new TablaSampler();

    // Active nodes tracking (for stopping immediately on pause)
    this.activeOscillators = [];

    // Tabla strokes are tracked apart from activeOscillators, so pausing the
    // lehra leaves the theka running - the same way the tanpura keeps droning.
    this.tablaNodes = [];

    // Callbacks
    this.onBeatCallback = null;
  }

  init() {
    if (this.ctx) return;

    // Create AudioContext (handling browser security autoplay policy)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Create Node structure
    this.masterGain = this.ctx.createGain();
    this.lehraGain = this.ctx.createGain();
    this.droneGain = this.ctx.createGain();
    this.metronomeGain = this.ctx.createGain();
    this.tablaGain = this.ctx.createGain();

    // A struck piano or santoor note peaks far above its own average level, so
    // running the lehra loud enough to be comfortable would clip on the
    // attacks. This limiter sits on the lehra path only - the tanpura and the
    // metronome bypass it - and catches those peaks so the level can be turned
    // up without distorting. It stays out of the way until something actually
    // approaches full scale.
    this.lehraLimiter = this.ctx.createDynamicsCompressor();
    this.lehraLimiter.threshold.value = -3;
    this.lehraLimiter.knee.value = 0;
    this.lehraLimiter.ratio.value = 20;
    this.lehraLimiter.attack.value = 0.003;
    this.lehraLimiter.release.value = 0.15;

    // Connect individual volume nodes to master gain
    this.lehraGain.connect(this.lehraLimiter);
    this.lehraLimiter.connect(this.masterGain);
    this.droneGain.connect(this.masterGain);
    this.metronomeGain.connect(this.masterGain);

    // The tabla stays off the lehra limiter - that one starts working at -3 dB
    // and a dha is a transient by nature, so it would take the attack off every
    // stroke. It gets a catch of its own instead, sitting just under full scale:
    // the theka has by far the highest crest factor of the four buses (measured
    // peak -3.2 dB against a loudness of -28.5), so it is the one that reaches
    // 0 dB first when its slider goes up.
    //
    // The attack and knee are set for the bayan rather than for the dayan. A
    // 1 ms attack is shorter than one cycle of a 90 Hz bayan, so the detector
    // followed the waveform instead of its envelope and modulated the drum at
    // its own fundamental - heard as the bass tightening up on every stroke
    // rather than as level being controlled. 4 ms is longer than that cycle and
    // still well inside the stroke. The knee spreads the onset over the 6 dB
    // below the threshold too, so what it does when it does engage is gradual
    // instead of a wall, and the slower release stops it recovering audibly
    // inside the bayan's own decay.
    this.tablaLimiter = this.ctx.createDynamicsCompressor();
    this.tablaLimiter.threshold.value = -1;
    this.tablaLimiter.knee.value = 6;
    this.tablaLimiter.ratio.value = 20;
    this.tablaLimiter.attack.value = 0.004;
    this.tablaLimiter.release.value = 0.18;

    this.tablaGain.connect(this.tablaLimiter);
    this.tablaLimiter.connect(this.masterGain);

    // Safety net on the sum. Each bus is clean on its own and the balanced mix
    // leaves about a decibel spare, but the four sliders all reach 100 and a
    // user is entitled to put them there: with everything up, the peaks land
    // some 2 dB over full scale. This catches that, and only that - through
    // normal use it is idle.
    this.masterLimiter = this.ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -1;
    this.masterLimiter.knee.value = 0;
    this.masterLimiter.ratio.value = 20;
    this.masterLimiter.attack.value = 0.002;
    this.masterLimiter.release.value = 0.12;

    // Master volume connects to audio output
    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.ctx.destination);

    // Initial volumes. Everything but the master comes from the measured mix in
    // MIX above, so these cannot drift from the slider handlers in app.js.
    //
    // The master is set for headroom rather than for loudness: with all four
    // buses balanced and sounding at once the sum peaks around -1 dBFS here,
    // and that spare decibel is deliberate. Turn this up and the mix gets
    // louder as far as the master limiter, and flatter after that.
    this.masterGain.gain.value = 0.45;
    this.lehraGain.gain.value = mixGain("lehra", MIX_DEFAULT_PERCENT);
    this.droneGain.gain.value = mixGain("tanpura", MIX_DEFAULT_PERCENT);
    this.metronomeGain.gain.value = mixGain("metronome", MIX_DEFAULT_PERCENT);
    this.tablaGain.gain.value = mixGain("tabla", MIX_DEFAULT_PERCENT);

    this.sampler.attach(this.ctx);
    this.tabla.attach(this.ctx);

    this.initStretchWorker();
  }

  /**
   * Decodes one instrument's recordings ahead of time. Playback itself cannot
   * wait on a fetch, so anything not loaded by the time Play is pressed simply
   * plays as the synthesised voice until the samples arrive.
   */
  async preloadInstrument(key) {
    this.init();
    return this.sampler.load(key);
  }

  /**
   * Routes a note to its recording when one is available. Returns false when
   * the caller should fall back to its oscillator version.
   */
  playSampled(key, freq, duration, time, volumeScalar = 1.0) {
    if (!this.sampler.isReady(key)) return false;
    const source = this.sampler.play(key, freq, duration, time, this.lehraGain, volumeScalar);
    if (!source) return false;
    this.trackNode(source);
    return true;
  }

  /**
   * Creating the AudioContext and decoding audio do not require a user
   * gesture, only playback does - so this can run at page load, well before
   * Play is ever pressed. init() itself is safe to call this early because it
   * never calls ctx.resume() or starts a source.
   */
  initStretchWorker() {
    if (this.stretchWorker || typeof Worker === "undefined") return;
    try {
      this.stretchWorker = new Worker("tanpura-worker.js");
      this.stretchWorker.onmessage = (e) => {
        const { id, channelsData, length } = e.data;
        const pending = this._stretchPending.get(id);
        this._stretchPending.delete(id);
        if (pending) pending.resolve({ channelsData, length });
      };
      this.stretchWorker.onerror = (err) => {
        console.warn("Tanpura stretch worker failed; falling back to a main-thread stretch.", err);
        this.stretchWorker = null;
      };
    } catch (e) {
      this.stretchWorker = null;
    }
  }

  /** Warms the tanpura sample cache well before Play is first pressed. */
  async preloadTanpuraSamples() {
    this.init();
    await Promise.all(Object.keys(TANPURA_SAMPLES).map(type => this.loadTanpuraSample(type)));
  }

  /** Same, for the tabla strokes. */
  async preloadTablaSamples() {
    this.init();
    return this.tabla.load();
  }

  start() {
    this.init();
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    if (this.isPlaying) return;

    this.isPlaying = true;
    this.lastFluteFrequency = null;
    this._ensureSchedulerRunning();
  }

  stop() {
    this.isPlaying = false;
    this._maybeStopScheduler();
    this.lastFluteFrequency = null;

    // Stop and clear active lehra/metronome nodes. Tanpura nodes are tracked
    // separately in tanpuraNodes so the drone keeps ringing through a pause.
    this.activeOscillators.forEach(osc => {
      try { osc.stop(); } catch(e) {}
    });
    this.activeOscillators = [];
  }

  // Metronome click, independent of the Lehra transport - it can run on its
  // own (practising tabla with no melody) or alongside the Lehra, sharing the
  // same matra clock so the two never drift apart when both are on.
  startMetronome() {
    this.init();
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    if (this.metronomeIsPlaying) return;
    this.metronomeIsPlaying = true;
    this._ensureSchedulerRunning();
  }

  stopMetronome() {
    this.metronomeIsPlaying = false;
    this._maybeStopScheduler();
  }

  // The theka of the active taal, one bol per matra. Independent of the lehra
  // transport in the same way the metronome is, and on the same matra clock, so
  // the tabla, the click and the melody all land on the same Sam.
  //
  // Resolves once the recordings are decoded, so the caller can wait before it
  // reports the tabla as playing. Nothing sounds until they are in.
  async startTabla() {
    this.init();
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    if (this.tablaIsPlaying) return true;

    await this.tabla.load();
    if (!this.tabla.isReady()) return false;

    this.tablaIsPlaying = true;
    this._ensureSchedulerRunning();
    return true;
  }

  stopTabla() {
    this.tablaIsPlaying = false;
    this._maybeStopScheduler();

    // Cut whatever is still ringing. Strokes are scheduled up to a tenth of a
    // second ahead, so without this a stopped tabla gets one more bol after the
    // button has been pressed.
    this.tablaNodes.forEach(node => {
      try { node.stop(); } catch (e) {}
    });
    this.tablaNodes = [];
  }

  _ensureSchedulerRunning() {
    if (this._schedulerRunning) return;
    this._schedulerRunning = true;
    this.nextNoteTime = this.ctx.currentTime;
    this.currentMatraIndex = 0;
    this.scheduler();
  }

  _maybeStopScheduler() {
    if (this.isPlaying || this.metronomeIsPlaying || this.tablaIsPlaying) return;
    this._schedulerRunning = false;
    clearTimeout(this.timerId);
  }

  _trackTablaNodes(nodes) {
    nodes.forEach(node => {
      this.tablaNodes.push(node);
      node.onended = () => {
        const idx = this.tablaNodes.indexOf(node);
        if (idx > -1) this.tablaNodes.splice(idx, 1);
      };
    });
  }

  trackNode(...nodes) {
    nodes.forEach(node => {
      this.activeOscillators.push(node);
      node.onended = () => {
        const idx = this.activeOscillators.indexOf(node);
        if (idx > -1) {
          this.activeOscillators.splice(idx, 1);
        }
      };
    });
  }

  get pitch() {
    return this._pitch || "C#";
  }

  set pitch(val) {
    if (this._pitch === val) return;
    this._pitch = val;
    this.onPitchChange();
  }

  get pitchCents() {
    return this._pitchCents || 0;
  }

  set pitchCents(val) {
    if (this._pitchCents === val) return;
    this._pitchCents = val;
    this.onPitchChange();
  }

  /**
   * Called immediately whenever scale (pitch) or fine-tune (pitchCents) changes.
   * Instantly stops active old-pitch notes and reschedules the current beat at the new pitch.
   */
  onPitchChange() {
    if (this.tabla) {
      this.tabla.setPitch(this.pitch, this.pitchCents);
    }

    if (this.tanpuraPlaying && this.ctx) {
      const cfg = TANPURA_SAMPLES[this.tanpuraDroneType];
      if (cfg) {
        const rate = this.getTanpuraPlaybackRate(cfg.sourceSaHz);
        this.tanpuraNodes.forEach(entry => {
          if (entry && entry.source && entry.source.playbackRate) {
            try {
              entry.source.playbackRate.setValueAtTime(rate, this.ctx.currentTime);
            } catch(e) {}
          }
        });
      }
    }

    if (this.isPlaying && this.ctx) {
      this.activeOscillators.forEach(node => {
        try { node.stop(this.ctx.currentTime); } catch(e) {}
      });
      this.activeOscillators = [];

      this.nextNoteTime = this.ctx.currentTime;
      if (this._schedulerRunning) {
        clearTimeout(this.timerId);
        this.scheduler();
      }
    }
  }

  /**
   * The reference Sa in Hz: the selected scale, bent by the fine-tune offset.
   *
   * The single place the two halves of the scale setting are combined, so the
   * lehra, the tanpura and the dayan cannot end up tuned to different Sas.
   */
  saFrequency() {
    let base = PITCH_MAP[this.pitch] || 277.18; // Default C#
    if (["G", "G#", "A", "A#", "B"].includes(this.pitch)) {
      base = base / 2;
    }
    return base * Math.pow(2, (this.pitchCents || 0) / 1200);
  }

  // Gets the frequency of a note offset relative to the current scale base frequency
  getFrequency(semitoneOffset) {
    // f = base * 2^(offset/12)
    return this.saFrequency() * Math.pow(2, semitoneOffset / 12);
  }

  // Precise Scheduler Loop (A Tale of Two Clocks)
  scheduler() {
    if (!this.isPlaying && !this.metronomeIsPlaying && !this.tablaIsPlaying) {
      this._schedulerRunning = false;
      return;
    }

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentMatraIndex, this.nextNoteTime);
      this.advanceNote();
    }

    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;

    const taal = TAAL_DATA[this.activeTaalKey];
    this.currentMatraIndex = (this.currentMatraIndex + 1) % taal.matras;
  }

  getResolvedNote(index, notes) {
    if (window._activeRaagKey === "mylehra" && this.bpm > 180) {
      const drutNotes = [12, null, null, 9, 14, null, 16, 17, 15, null, 12, 14, 11, 12, 9, 10];
      return drutNotes[index % drutNotes.length];
    }

    if (window._activeRaagKey === "mylehra2" && this.bpm > 180) {
      const drutNotes = [12, null, 12, null, 12, null, 12, 14, 11, null, null, 7, 9, 7, 4, 7];
      return drutNotes[index % drutNotes.length];
    }

    const note = notes[index % notes.length];
    if (window._activeRaagKey === "des" && this.bpm < 110) {
      if ((index % notes.length) === 1 && note === null) {
        return 12;
      }
      if ((index % notes.length) === 2 && note === null) {
        return 12;
      }
    }
    return note;
  }

  scheduleNote(matraIndex, time) {
    const taal = TAAL_DATA[this.activeTaalKey];

    // Taal-aware click on every matra. Silence it with the volume slider, or
    // stop it independently via stopMetronome().
    if (this.metronomeIsPlaying) {
      this.playMetronomeClick(matraIndex, time);
    }

    if (this.tablaIsPlaying) {
      this.playTheka(matraIndex, time);
    }

    if (!this.isPlaying) {
      this._scheduleBeatCallback(matraIndex, time);
      return;
    }

    const notes = taal.lehra[this.instrument] || taal.lehra["harmonium"];
    const semitone = this.getResolvedNote(matraIndex, notes);

    // Look ahead to check for sustained beats (null values / sub-beat nulls)
    let sustainCount = 0;
    if (semitone !== null) {
      let nextIdx = (matraIndex + 1) % notes.length;
      while (true) {
        const nextSemitone = this.getResolvedNote(nextIdx, notes);
        if (nextSemitone === null) {
          sustainCount++;
          nextIdx = (nextIdx + 1) % notes.length;
        } else if (Array.isArray(nextSemitone)) {
          let leadingNulls = 0;
          for (let i = 0; i < nextSemitone.length; i++) {
            if (nextSemitone[i] === null) {
              leadingNulls++;
            } else {
              break;
            }
          }
          sustainCount += leadingNulls / nextSemitone.length;
          break;
        } else {
          break;
        }
      }
    }

    const beatDuration = 60.0 / this.bpm;
    const duration = beatDuration * (1 + sustainCount);

    // The lehra is the melody line and nothing else. Backing chords, the
    // guitar's shaker and its kick drum used to play underneath - they are
    // gone deliberately, so every instrument gives a clean single line to
    // practise against.
    this.playLehraTone(semitone, time, duration);

    this._scheduleBeatCallback(matraIndex, time);
  }

  // Call UI update callback on main thread at the exact moment of playback.
  // Shared by the lehra path and the metronome-only path so the beat
  // indicator stays in sync either way.
  _scheduleBeatCallback(matraIndex, time) {
    if (!this.onBeatCallback) return;
    const delay = (time - this.ctx.currentTime) * 1000;
    setTimeout(() => {
      if ((this.isPlaying || this.metronomeIsPlaying || this.tablaIsPlaying) && this.onBeatCallback) {
        this.onBeatCallback(matraIndex);
      }
    }, Math.max(0, delay));
  }

  // --- Lehra Instrument Synths ---

  /** Sounds one frequency on whichever instrument is currently selected. */
  playInstrumentTone(freq, duration, time) {
    if (this.instrument === "harmonium") {
      this.playHarmoniumTone(freq, duration, time);
    } else if (this.instrument === "flute") {
      this.playFluteTone(freq, duration, time);
    } else if (this.instrument === "sitar") {
      this.playSitarTone(freq, duration, time);
    } else if (this.instrument === "piano") {
      this.playPianoTone(freq, duration, time);
    } else if (this.instrument === "santoor") {
      this.playSantoorTone(freq, duration, time);
    } else if (this.instrument === "guitar") {
      this.playGuitarTone(freq, duration, time);
    } else if (this.instrument === "violin") {
      this.playViolinTone(freq, duration, time);
    }
  }

  /**
   * `duration` is the whole span this matra's swara occupies, which scheduleNote
   * has already stretched to cover any following null matras.
   */
  playLehraTone(semitoneOffset, time, duration = null) {
    if (semitoneOffset === null || semitoneOffset === undefined) return;

    const matraDuration = 60.0 / this.bpm;
    const totalSpan = duration || matraDuration;

    if (Array.isArray(semitoneOffset)) {
      // Sub-beats divide the matra itself, never the extended span: anything
      // past one matra came from following null matras, and belongs to the last
      // swara here rather than being shared out among all of them. Dividing the
      // full span instead used to smear the whole group across the sustain.
      const subDuration = matraDuration / semitoneOffset.length;
      const extraHold = Math.max(0, totalSpan - matraDuration);

      for (let index = 0; index < semitoneOffset.length; index++) {
        const offset = semitoneOffset[index];

        // A leading null is the tail of the previous matra's swara, which has
        // already been lengthened to cover it - so nothing new sounds here.
        if (offset === null || offset === undefined) continue;

        // Every null after a swara ties onto it, holding it through that slot
        // instead of leaving a gap. This is what lets a notation grid's held
        // swaras (म↦गम) be written as [5, null, 4, 5].
        let slots = 1;
        while (index + slots < semitoneOffset.length) {
          const next = semitoneOffset[index + slots];
          if (next !== null && next !== undefined) break;
          slots++;
        }

        const isLast = index + slots >= semitoneOffset.length;
        this.playInstrumentTone(
          this.getFrequency(offset),
          subDuration * slots + (isLast ? extraHold : 0),
          time + index * subDuration
        );

        index += slots - 1;
      }
      return;
    }

    this.playInstrumentTone(this.getFrequency(semitoneOffset), totalSpan, time);
  }

  playSantoorTone(freq, duration, time) {
    if (this.playSampled("santoor", freq, duration, time)) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const oscHarmonic = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Detuned string unison (3 strings per note) for rich natural chorus
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(freq, time);
    osc1.detune.setValueAtTime(-2.8, time);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(2.8, time);

    osc3.type = "sine";
    osc3.frequency.setValueAtTime(freq, time);
    osc3.detune.setValueAtTime(0, time);

    // Metallic high chime harmonic
    oscHarmonic.type = "sine";
    oscHarmonic.frequency.setValueAtTime(freq * 3.01, time); // slightly off-integer to simulate string stiffness (inharmonist)

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, time);
    filter.Q.setValueAtTime(4, time);

    // Hammer envelope (mezrab strike)
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.55, time + 0.003); // sharp pluck strike
    gainNode.gain.exponentialRampToValueAtTime(0.12, time + Math.min(0.12, duration * 0.25)); // fast hammer release
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration * 1.5); // long ringing resonance release

    // Connections
    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    
    const harmonicGain = this.ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.28, time);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.35); // harmonic decays faster
    oscHarmonic.connect(harmonicGain);
    harmonicGain.connect(filter);

    filter.connect(gainNode);
    gainNode.connect(this.lehraGain);

    // 1. Woody mezrab mallet strike click
    const bufferSize = this.ctx.sampleRate * 0.006; // 6ms burst
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2500, time);
    noiseFilter.Q.setValueAtTime(6, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.008);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    gainNode.connect(noiseGain); // Connect direct path to hit as well
    noiseGain.connect(this.lehraGain);

    // 2. Sympathetic box resonance loop (santoor body resonance)
    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.09, time); // 90ms delay
    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.38, time); // higher feedback for ringing box resonance

    gainNode.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(this.lehraGain);

    // Playback
    osc1.start(time);
    osc2.start(time);
    osc3.start(time);
    oscHarmonic.start(time);
    noiseNode.start(time);

    osc1.stop(time + duration * 1.6);
    osc2.stop(time + duration * 1.6);
    osc3.stop(time + duration * 1.6);
    oscHarmonic.stop(time + duration * 0.45);

    this.trackNode(osc1, osc2, osc3, oscHarmonic);
  }

  playHarmoniumTone(freq, duration, time) {
    if (this.playSampled("harmonium", freq, duration, time)) return;

    // Rich harmonium uses multiple oscillators detuned with lowpass filter
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator(); // Sub octave
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(freq, time);

    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(freq + 1.5, time); // detuned slightly

    osc3.type = "triangle";
    osc3.frequency.setValueAtTime(freq / 2, time); // sub-octave

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, time);

    const attackTime = duration * 0.15;
    const holdTime = duration * 0.8;

    gainNode.gain.setValueAtTime(0, time);
    // Smooth bellows attack
    gainNode.gain.linearRampToValueAtTime(0.4, time + attackTime);
    gainNode.gain.setValueAtTime(0.4, time + holdTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.05);

    // Connections
    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    
    // Scale sub-oscillator and detuned saw down (enhanced bass from 0.2 to 0.45)
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.45, time);
    osc3.disconnect(filter);
    osc3.connect(subGain);
    subGain.connect(filter);

    filter.connect(gainNode);
    gainNode.connect(this.lehraGain);

    osc1.start(time);
    osc2.start(time);
    osc3.start(time);

    osc1.stop(time + duration + 0.06);
    osc2.stop(time + duration + 0.06);
    osc3.stop(time + duration + 0.06);

    this.trackNode(osc1, osc2, osc3);
  }

  playPianoTone(freq, duration, time, volumeScalar = 1.0) {
    if (this.playSampled("piano", freq, duration, time, volumeScalar)) return;

    // 1. Detuned Unison for the Fundamental (3 strings per key)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    
    // 2. High-Order Harmonics for realistic acoustic strike timbre
    const oscHarmonic2 = this.ctx.createOscillator();
    const oscHarmonic3 = this.ctx.createOscillator();
    const oscHarmonic4 = this.ctx.createOscillator();

    // Configure oscillators
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq, time);
    osc1.detune.setValueAtTime(-2.0, time);

    // Detuned outer strings for grand chorus effect
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(0, time);

    osc3.type = "sine";
    osc3.frequency.setValueAtTime(freq, time);
    osc3.detune.setValueAtTime(2.0, time);

    oscHarmonic2.type = "triangle";
    oscHarmonic2.frequency.setValueAtTime(freq * 2, time);

    oscHarmonic3.type = "sine";
    oscHarmonic3.frequency.setValueAtTime(freq * 3, time);

    oscHarmonic4.type = "sine";
    oscHarmonic4.frequency.setValueAtTime(freq * 4, time);

    // 3. Setup individual envelopes (higher harmonics decay faster!)
    const fundamentalGain = this.ctx.createGain();
    fundamentalGain.gain.setValueAtTime(0, time);
    fundamentalGain.gain.linearRampToValueAtTime(0.40 * volumeScalar, time + 0.004); // very fast string attack
    fundamentalGain.gain.exponentialRampToValueAtTime(0.12 * volumeScalar, time + Math.min(0.2, duration * 0.4));
    fundamentalGain.gain.exponentialRampToValueAtTime(0.001, time + duration * 1.6); // long fundamental ring-out

    const h2Gain = this.ctx.createGain();
    h2Gain.gain.setValueAtTime(0, time);
    h2Gain.gain.linearRampToValueAtTime(0.20 * volumeScalar, time + 0.003);
    h2Gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.7);

    const h3Gain = this.ctx.createGain();
    h3Gain.gain.setValueAtTime(0, time);
    h3Gain.gain.linearRampToValueAtTime(0.12 * volumeScalar, time + 0.003);
    h3Gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.4);

    const h4Gain = this.ctx.createGain();
    h4Gain.gain.setValueAtTime(0, time);
    h4Gain.gain.linearRampToValueAtTime(0.08 * volumeScalar, time + 0.002);
    h4Gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.2);

    // Lowpass filter to smooth string warmth
    const masterFilter = this.ctx.createBiquadFilter();
    masterFilter.type = "lowpass";
    masterFilter.frequency.setValueAtTime(1100, time);

    // Connections
    osc1.connect(fundamentalGain);
    osc2.connect(fundamentalGain);
    osc3.connect(fundamentalGain);
    oscHarmonic2.connect(h2Gain);
    oscHarmonic3.connect(h3Gain);
    oscHarmonic4.connect(h4Gain);

    fundamentalGain.connect(masterFilter);
    h2Gain.connect(masterFilter);
    h3Gain.connect(masterFilter);
    h4Gain.connect(masterFilter);

    masterFilter.connect(this.lehraGain);

    // 4. Felt Hammer Knock Noise (wooden strike click)
    const noiseBufferSize = this.ctx.sampleRate * 0.015; // 15ms felt hit
    const noiseBuffer = this.ctx.createBuffer(1, noiseBufferSize, this.ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1200, time); // low wood knock frequency
    noiseFilter.Q.setValueAtTime(3.5, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08 * volumeScalar, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.012);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.lehraGain);

    // 5. Soundboard Sympathetic Resonance Delay
    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.055, time); // 55ms resonance reflection
    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.26, time);

    fundamentalGain.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(this.lehraGain);

    // Start playback
    osc1.start(time);
    osc2.start(time);
    osc3.start(time);
    oscHarmonic2.start(time);
    oscHarmonic3.start(time);
    oscHarmonic4.start(time);
    noiseNode.start(time);

    // Stop playback
    osc1.stop(time + duration * 1.7);
    osc2.stop(time + duration * 1.7);
    osc3.stop(time + duration * 1.7);
    oscHarmonic2.stop(time + duration * 0.8);
    oscHarmonic3.stop(time + duration * 0.5);
    oscHarmonic4.stop(time + duration * 0.3);

    this.trackNode(osc1, osc2, osc3, oscHarmonic2, oscHarmonic3, oscHarmonic4);
  }

  playFluteTone(freq, duration, time) {
    if (this.playSampled("flute", freq, duration, time)) return;

    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // 1. Triangle wave is the standard starting point for flutes (contains odd harmonics)
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);

    // 2. Lowpass filter to smooth out the triangle harmonics into a warm flute tone
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq * 1.6, time); // tracks note frequency dynamically
    filter.Q.setValueAtTime(1, time);

    // 3. Vibrato (LFO)
    lfo.frequency.setValueAtTime(5.5, time); // 5.5Hz vibrato
    lfoGain.gain.setValueAtTime(6, time); // 6 cents subtle depth
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);

    // 4. Attack/Sustain/Release envelope
    const attackTime = 0.08; // smooth woodwind blow onset
    const releaseTime = 0.08;
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.45, time + attackTime);
    gainNode.gain.setValueAtTime(0.45, time + duration - 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration + releaseTime);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.lehraGain);

    // 5. Soft breath noise (high-passed white noise for realistic wind blowing sound)
    const bufferSize = this.ctx.sampleRate * 0.15; // 150ms buffer
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2000, time);
    noiseFilter.Q.setValueAtTime(2, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.012, time); // very soft breath noise
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.lehraGain);

    lfo.start(time);
    osc.start(time);
    noiseNode.start(time);

    const stopTime = time + duration + releaseTime + 0.02;
    lfo.stop(stopTime);
    osc.stop(stopTime);
    noiseNode.stop(time + duration);

    this.trackNode(osc, lfo);
  }

  createGuitarBuffer(freq, duration) {
    const sampleRate = this.ctx.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    // Waveform period in samples
    const period = Math.round(sampleRate / freq);
    
    // Seed delay line with noise (pick excitation)
    const delayLine = new Float32Array(period);
    for (let i = 0; i < period; i++) {
      delayLine[i] = Math.random() * 2 - 1;
    }

    // Smooth the noise excitation to make the pick strike sound organic (finger/pluck warmth)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < period; i++) {
        delayLine[i] = 0.5 * (delayLine[i] + delayLine[(i + 1) % period]);
      }
    }

    // Karplus-Strong feedback string decay physics
    // Higher frequencies decay faster (higher string damping)
    const feedback = Math.min(0.995, 0.996 - (freq * 0.000018));
    
    for (let i = 0; i < numSamples; i++) {
      const delayIndex = i % period;
      const val = delayLine[delayIndex];

      // Averaging low-pass filter to simulate high-frequency dissipation
      const nextIndex = (delayIndex + 1) % period;
      const nextVal = delayLine[nextIndex];
      const filtered = 0.5 * (val + nextVal);

      const outputVal = filtered * feedback;
      delayLine[delayIndex] = outputVal;

      data[i] = outputVal;
    }

    return buffer;
  }

  playGuitarTone(freq, duration, time, volumeScalar = 1.0) {
    if (this.playSampled("guitar", freq, duration, time, volumeScalar)) return;

    // Generate Karplus-Strong buffer for the required duration plus string ring-out time
    const ringTime = Math.max(1.8, duration * 2.2);
    const buffer = this.createGuitarBuffer(freq, ringTime);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Filter to capture the body resonance of an acoustic guitar (wood box frequency)
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(380, time); // warm wood box frequency
    filter.Q.setValueAtTime(1.2, time);

    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.75, time);
    bodyGain.gain.setValueAtTime(0.75, time + duration - 0.05);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.05);

    // Direct high-frequency string definition (adds brightness/steel ring)
    const stringGain = this.ctx.createGain();
    stringGain.gain.setValueAtTime(0.45, time);
    stringGain.gain.setValueAtTime(0.45, time + duration - 0.05);
    stringGain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.05);

    source.connect(filter);
    filter.connect(bodyGain);
    bodyGain.connect(this.lehraGain);

    source.connect(stringGain);
    stringGain.connect(this.lehraGain);

    // Guitar body sympathetic resonance reflection delay
    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.065, time); // 65ms reflection time
    const delayFeedback = this.ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.24, time);

    bodyGain.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(this.lehraGain);

    source.start(time);
    source.stop(time + duration + 0.06);

    this.trackNode(source);
  }

  playSitarTone(freq, duration, time) {
    if (this.playSampled("sitar", freq, duration, time)) return;

    // Sitar has a metallic, buzzy pluck. Additive synthesis or waveshaper with rapid decay.
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);

    // Highly resonant filter sweep to simulate sitar jawari/buzzing
    filter.type = "bandpass";
    filter.Q.setValueAtTime(6, time);
    filter.frequency.setValueAtTime(1200, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + Math.min(0.15, duration * 0.5));

    gainNode.gain.setValueAtTime(0.7, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.95);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.lehraGain);

    osc.start(time);
    osc.stop(time + duration);

    this.trackNode(osc);
  }

  /**
   * Violin. The recordings are real bowed violin (VSCO2 via
   * tonejs-instruments) - see VIOLIN_DIR - so this only sounds as a fallback
   * if those fail to load.
   *
   * Two lightly detuned saws stand in for the bow's harmonic-rich sawtooth
   * excitation and its sympathetic string shimmer, shaped through a body
   * lowpass and a bright upper-formant peak - a violin's presence sits much
   * higher and narrower than a nasal double-reed or a sarangi's. No
   * feedback-delay "resonance" loop like the plucked voices use - those
   * cycles are never disconnected and accumulate nodes for the life of the
   * page.
   */
  playViolinTone(freq, duration, time) {
    if (this.playSampled("violin", freq, duration, time)) return;

    const bow = this.ctx.createOscillator();
    const symp = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const body = this.ctx.createBiquadFilter();
    const formant = this.ctx.createBiquadFilter();

    bow.type = "sawtooth";
    bow.frequency.setValueAtTime(freq, time);

    // Sympathetic strings ring a touch off the bowed pitch, which is what
    // gives a real violin its shimmer rather than a clean unison.
    symp.type = "sawtooth";
    symp.frequency.setValueAtTime(freq, time);
    symp.detune.setValueAtTime(-5, time);

    body.type = "lowpass";
    body.frequency.setValueAtTime(Math.min(5500, freq * 8), time);
    body.Q.setValueAtTime(0.7, time);

    formant.type = "peaking";
    formant.frequency.setValueAtTime(freq * 4, time);
    formant.Q.setValueAtTime(2.5, time);
    formant.gain.setValueAtTime(7, time);

    // A bow takes a moment to speak, and never clicks on release.
    const attack = Math.min(0.05, duration * 0.3);
    const release = Math.min(0.1, Math.max(0.04, duration * 0.25));
    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.linearRampToValueAtTime(0.3, time + attack);
    gainNode.gain.setValueAtTime(0.3, time + duration);
    gainNode.gain.linearRampToValueAtTime(0.0001, time + duration + release);

    const sympGain = this.ctx.createGain();
    sympGain.gain.setValueAtTime(0.3, time);

    bow.connect(formant);
    symp.connect(sympGain);
    sympGain.connect(formant);
    formant.connect(body);
    body.connect(gainNode);
    gainNode.connect(this.lehraGain);

    const stopTime = time + duration + release + 0.02;
    bow.start(time);
    symp.start(time);
    bow.stop(stopTime);
    symp.stop(stopTime);

    this.trackNode(bow, symp);
  }

  // --- Metronome (always taal-aware) ---
  playMetronomeClick(matraIndex, time) {
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = "sine";

    const isSam = matraIndex === 0;
    const taal = TAAL_DATA[this.activeTaalKey];

    const displayIndex = matraIndex + 1;
    const isTali = taal.tali_positions.includes(displayIndex);
    const isKhali = taal.khali_positions.includes(displayIndex);

    // Sam (high), Tali (medium), Khali (low woodblock), ordinary matra (soft tick).
    if (isSam) {
      osc.frequency.setValueAtTime(1500, time);
    } else if (isTali) {
      osc.frequency.setValueAtTime(1000, time);
    } else if (isKhali) {
      osc.frequency.setValueAtTime(500, time);
    } else {
      osc.frequency.setValueAtTime(700, time);
    }

    gainNode.gain.setValueAtTime(0.2, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gainNode);
    gainNode.connect(this.metronomeGain);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  // --- Tabla theka ---

  /**
   * Sounds the bol written at this matra of the active taal's theka.
   *
   * The theka array in TAAL_DATA is the notation as a tabla player would read
   * it, so this needs no rhythm of its own: matra n plays bol n, and the taal's
   * own structure - Tin and Ta carrying no bayan through the khali vibhaag -
   * does the rest.
   */
  playTheka(matraIndex, time) {
    const taal = TAAL_DATA[this.activeTaalKey];
    if (!taal || !taal.theka) return;

    const bol = taal.theka[matraIndex % taal.theka.length];
    const beatDuration = 60.0 / this.bpm;

    // Read here rather than on the change event: the scale selector writes
    // straight to AudioEngine.pitch, so this is the one place guaranteed to see
    // the current value however it was set.
    this.tabla.setPitch(this.pitch, this.pitchCents);

    // A player leans on Sam, and a listener has to be able to find it without
    // counting. This has to clear the +/-6% humanising jitter playBol applies to
    // every stroke, not just sit above the nominal level: at the 1.18 this used
    // to be, the two ranges overlapped and an unlucky pair of draws put Sam only
    // 0.4 dB above the Dha before it - which is nothing. At 1.40 they no longer
    // meet, so Sam is at worst 1.9 dB up and on average nearer 3 dB, whatever
    // the dice do.
    //
    // Still emphasis rather than a downbeat click: the accent scales the whole
    // bol, so the bayan and the dayan lean together the way a hand does, instead
    // of one stroke jumping out of the theka. The tabla limiter takes about
    // 0.4 dB back off the peak of it, which is why this is not lower.
    const accent = matraIndex === 0 ? 1.40 : 1.0;

    const nodes = this.tabla.playBol(bol, time, this.tablaGain, beatDuration, accent);
    this._trackTablaNodes(nodes);
  }

  // ============================================================
  //  TANPURA
  // ============================================================

  /**
   * Semitone offset of the first (variable) string, relative to madhya Sa.
   * The four strings are <first> - Sa - Sa - sa, where the first sits in the
   * mandra saptak and the last is mandra Sa.
   *
   *   mandra Sa = -12, therefore:
   *   mandra Pa = -12 + 7  = -5   (standard tuning, most raags)
   *   mandra Ma = -12 + 5  = -7   (Malkauns, Bageshri, Lalit)
   *   mandra Ni = -12 + 11 = -1   (Marwa, Puriya, Sohani, Poorvi)
   */
  getFirstStringOffset() {
    if (this.tanpuraDroneType === "ma") return -7;
    if (this.tanpuraDroneType === "ni") return -1;
    return -5;
  }

  /**
   * playbackRate needed to move a sample's tonic onto the user's chosen Sa.
   *
   * PITCH_MAP is written in octave 4, higher than a tanpura normally sits, so we
   * pick whichever octave of the target lands nearest the source tonic. That keeps
   * the shift within roughly +/- 6 semitones. A drone is harmonically static, so
   * resampling reads as a larger or smaller tanpura rather than as an artefact -
   * which is how real tanpuras genuinely vary between male and female instruments.
   */
  getTanpuraPlaybackRate(sourceSaHz) {
    const target = this.saFrequency();
    let best = target;
    let bestCents = Infinity;

    for (let oct = -3; oct <= 3; oct++) {
      const candidate = target * Math.pow(2, oct);
      const cents = Math.abs(1200 * Math.log2(candidate / sourceSaHz));
      if (cents < bestCents) {
        bestCents = cents;
        best = candidate;
      }
    }
    return best / sourceSaHz;
  }

  /**
   * Overlap-add time stretch, used to change how fast the tanpura is plucked
   * without touching its pitch.
   *
   * playbackRate cannot do this: on an AudioBufferSourceNode, rate and detune
   * drive the same computed value, so speeding the drone up that way would pull
   * it off Sa - which defeats the point of a tuning reference. Instead we rebuild
   * the buffer, taking 150ms grains at one spacing and laying them down at
   * another. Hann windows at 50% overlap sum to unity, so the level is preserved.
   *
   * factor > 1 stretches (slower plucks), < 1 compresses (faster plucks).
   */
  /**
   * Synchronous fallback used only where Web Workers are unavailable. Delegates
   * to the shared stretchChannelsWSOLA (tanpura-dsp.js) so the two paths can
   * never drift apart. This still blocks whatever thread calls it, which is why
   * getActiveTanpuraBuffer() below must never call it from the scheduler -
   * doing that used to freeze playback on every tempo change.
   */
  timeStretchBuffer(buffer, factor) {
    if (Math.abs(factor - 1) < 0.01) return buffer;

    const channelsData = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channelsData.push(buffer.getChannelData(c).slice());
    }
    const stretched = stretchChannelsWSOLA(channelsData, buffer.sampleRate, factor);

    const out = this.ctx.createBuffer(stretched.length, stretched[0].length, buffer.sampleRate);
    for (let c = 0; c < stretched.length; c++) out.copyToChannel(stretched[c], c);
    return out;
  }

  /**
   * Same computation as timeStretchBuffer, but off the main thread via the
   * stretch worker, resolving once the result comes back. Falls back to the
   * synchronous path only if Workers are unsupported.
   */
  stretchBufferAsync(buffer, factor) {
    if (Math.abs(factor - 1) < 0.01) return Promise.resolve(buffer);

    if (!this.stretchWorker) {
      return Promise.resolve(this.timeStretchBuffer(buffer, factor));
    }

    const id = ++this._stretchSeq;
    const channelsData = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channelsData.push(buffer.getChannelData(c).slice());   // copy: postMessage transfer detaches it
    }
    const transferList = channelsData.map(a => a.buffer);

    return new Promise((resolve) => {
      this._stretchPending.set(id, { resolve });
      this.stretchWorker.postMessage(
        { id, channelsData, sampleRate: buffer.sampleRate, factor },
        transferList
      );
    }).then(({ channelsData: resultChannels, length }) => {
      const out = this.ctx.createBuffer(resultChannels.length, length, buffer.sampleRate);
      for (let c = 0; c < resultChannels.length; c++) out.copyToChannel(resultChannels[c], c);
      return out;
    });
  }

  /**
   * The buffer currently being played, with its loop region. Read-only and O(1):
   * this runs on the real-time scheduling path (scheduleTanpuraCycle), so it
   * must NEVER compute a stretch itself - that used to freeze audio and the UI
   * for a few hundred ms on every tempo change. All stretching happens ahead of
   * time in _ensureTempoAndRestart(); this only ever reads what is already
   * cached there, in this.tanpuraTempo, or falls back to the raw recording.
   */
  getActiveTanpuraBuffer() {
    const type = this.tanpuraDroneType;
    const original = this.tanpuraBuffers[type];
    if (!original) return null;

    const factor = this.tanpuraTempo;
    if (Math.abs(factor - 1) < 0.01) return original;

    const cached = this.stretchedBuffers[type + "_" + factor.toFixed(2)];
    if (cached) return cached;

    // Requested tempo isn't ready yet (still being computed in the background).
    // Keep playing the untouched recording rather than blocking to build it -
    // this.tanpuraTempo only advances once the cache entry above exists.
    return original;
  }

  /**
   * Stops any currently-sounding tanpura sources with a fast fade and
   * immediately starts a fresh cycle - used after a tempo/tuning change so the
   * new setting audibly takes effect right away, instead of waiting out
   * whatever remains of the current (possibly 30+ second) loop pass.
   */
  restartTanpuraCycleIfPlaying() {
    if (!this.tanpuraPlaying || !this.usingSampledTanpura || !this.ctx) return;

    const now = this.ctx.currentTime;
    this.tanpuraSources.forEach(({ source, gain }) => {
      try {
        // Scale the fade-out curve by wherever this source currently sits, so a
        // pass caught mid-crossfade eases down from its actual level instead of
        // jumping to full first. setValueCurveAtTime cannot share a timestamp
        // with any other automation event, hence cancel-then-curve with nothing
        // in between.
        const current = gain.gain.value;
        gain.gain.cancelScheduledValues(now);
        const curve = new Float32Array(TANPURA_CURVE_POINTS);
        for (let i = 0; i < TANPURA_CURVE_POINTS; i++) {
          curve[i] = TANPURA_FADE_OUT_CURVE[i] * current;
        }
        gain.gain.setValueCurveAtTime(curve, now, TANPURA_RESTART_FADE);
        source.stop(now + TANPURA_RESTART_FADE + 0.05);
      } catch (e) {}
    });
    this.tanpuraSources = [];

    clearTimeout(this.cycleTimerId);
    this.nextCycleTime = now;
    this._pendingFadeIn = TANPURA_RESTART_FADE;
    this.cycleScheduler();
  }

  /**
   * Makes sure the (type, factor) variant is cached, then applies it. If it's
   * not cached yet, the CURRENT tempo keeps playing uninterrupted while the
   * worker computes the new one in the background - no dropout, no freeze.
   * A newer call (the user moving the slider again before this resolves)
   * supersedes this one via the request token, so a stale result never lands.
   */
  async _ensureTempoAndRestart(type, factor) {
    const key = type + "_" + factor.toFixed(2);
    const token = ++this._tempoRequestToken;

    if (Math.abs(factor - 1) < 0.01 || this.stretchedBuffers[key]) {
      this.tanpuraTempo = factor;
      this.restartTanpuraCycleIfPlaying();
      return;
    }

    const buffer = this.tanpuraBuffers[type];
    if (!buffer) {
      this.tanpuraTempo = factor;   // sample not loaded yet; nothing to stretch
      return;
    }

    const stretched = await this.stretchBufferAsync(buffer, factor);
    if (token !== this._tempoRequestToken) return;   // superseded by a newer request

    this.stretchedBuffers[key] = stretched;
    this.tanpuraTempo = factor;
    this.restartTanpuraCycleIfPlaying();
    if (this.onTanpuraStretchEnd) this.onTanpuraStretchEnd();
  }

  /** Slider hook: 1.0 is the recording's own pace, lower is faster. */
  async setTanpuraTempo(factor) {
    this.droneInterval = 1.6 * factor;   // the synth path just changes its gap, instantly
    await this._ensureTempoAndRestart(this.tanpuraDroneType, factor);
  }

  async loadTanpuraSample(type) {
    const cfg = TANPURA_SAMPLES[type];
    if (!cfg) return null;                          // no recording for this tuning
    if (this.tanpuraBuffers[type]) return this.tanpuraBuffers[type];
    if (this.tanpuraLoadFailed[type]) return null;

    try {
      const res = await fetch(cfg.url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const raw = await res.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(raw);
      this.tanpuraBuffers[type] = buffer;
      return buffer;
    } catch (e) {
      console.warn(`Tanpura sample "${type}" unavailable - falling back to synthesis.`, e);
      this.tanpuraLoadFailed[type] = true;
      return null;
    }
  }

  async startTanpura() {
    this.init();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (this.tanpuraPlaying) return;

    this.tanpuraPlaying = true;

    const buffer = await this.loadTanpuraSample(this.tanpuraDroneType);

    // The user may have switched it back off while the sample was decoding.
    if (!this.tanpuraPlaying) return;

    if (buffer) {
      this.usingSampledTanpura = true;
      this.nextCycleTime = this.ctx.currentTime + 0.02;
      this._pendingFadeIn = 0;   // sound the instant Play is pressed
      this.cycleScheduler();

      // If a non-default tempo was already dialled in (e.g. before the first
      // Play press), it plays at the recording's natural pace immediately and
      // then catches up once the background stretch is ready - never a freeze.
      const key = this.tanpuraDroneType + "_" + this.tanpuraTempo.toFixed(2);
      if (Math.abs(this.tanpuraTempo - 1) >= 0.01 && !this.stretchedBuffers[key]) {
        this._ensureTempoAndRestart(this.tanpuraDroneType, this.tanpuraTempo);
      }
    } else {
      this.usingSampledTanpura = false;
      this.nextPluckTime = this.ctx.currentTime + 0.05;
      this.currentStringIndex = 0;
      this.droneScheduler();
    }
  }

  stopTanpura() {
    this.tanpuraPlaying = false;
    clearTimeout(this.cycleTimerId);
    clearTimeout(this.droneTimerId);

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Fade out rather than cutting, so stopping never clicks.
    this.tanpuraSources.forEach(({ source, gain }) => {
      try {
        const current = gain.gain.value;
        gain.gain.cancelScheduledValues(now);
        const curve = new Float32Array(TANPURA_CURVE_POINTS);
        for (let i = 0; i < TANPURA_CURVE_POINTS; i++) {
          curve[i] = TANPURA_FADE_OUT_CURVE[i] * current;
        }
        gain.gain.setValueCurveAtTime(curve, now, 0.4);
        source.stop(now + 0.45);
      } catch (e) {}
    });
    this.tanpuraSources = [];

    this.tanpuraNodes.forEach(osc => {
      try { osc.stop(now + 0.4); } catch (e) {}
    });
    this.tanpuraNodes = [];
  }

  /**
   * Swap tuning (pa/ma/ni) live, restarting the drone if it is running.
   * The current tempo carries over: startTanpura()'s own catch-up logic below
   * notices the (new type, existing tempo) pair likely isn't cached yet and
   * fetches it in the background, exactly as if the user had just moved the
   * tempo slider.
   */
  async setTanpuraType(type) {
    this.tanpuraDroneType = type;
    if (this.tanpuraPlaying) {
      this.stopTanpura();
      await this.startTanpura();
    }
  }

  /** Re-pitch a running sampled drone after the user changes scale. */
  retuneTanpura() {
    if (this.tanpuraPlaying && this.usingSampledTanpura) {
      this.stopTanpura();
      this.startTanpura();
    }
  }

  // --- Sampled tanpura: seamless crossfaded looping ---

  cycleScheduler() {
    if (!this.tanpuraPlaying || !this.usingSampledTanpura) return;
    if (!this.tanpuraBuffers[this.tanpuraDroneType]) return;

    while (this.nextCycleTime < this.ctx.currentTime + 0.5) {
      const fadeIn = this._pendingFadeIn;
      this._pendingFadeIn = TANPURA_CROSSFADE;   // only the first pass is special
      this.scheduleTanpuraCycle(this.nextCycleTime, fadeIn);
    }

    this.cycleTimerId = setTimeout(() => this.cycleScheduler(), 200);
  }

  /**
   * Plays one pass over the recording and sets up the next pass to begin before
   * this one ends, so the two overlap. A tanpura is a continuous wash, so the
   * join has to be genuinely smooth rather than merely close.
   *
   * fadeInDuration of 0 starts at full level immediately - used for the very
   * first pass, so pressing Play produces sound instantly rather than easing in.
   */
  scheduleTanpuraCycle(startTime, fadeInDuration) {
    const cfg = TANPURA_SAMPLES[this.tanpuraDroneType];
    const buffer = this.getActiveTanpuraBuffer();
    if (!buffer || !cfg) return;

    const rate = this.getTanpuraPlaybackRate(cfg.sourceSaHz);

    // The recordings sound from end to end, so play essentially all of the file
    // and only trim MP3 encoder padding off the edges.
    const regionStart = TANPURA_EDGE_TRIM;
    const regionEnd = Math.max(regionStart + 1, buffer.duration - TANPURA_EDGE_TRIM);
    const playDuration = (regionEnd - regionStart) / rate;   // in real seconds

    const fadeOut = Math.min(TANPURA_CROSSFADE, playDuration / 3);
    const fadeIn = Math.max(0, Math.min(fadeInDuration, playDuration / 3));

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = this.ctx.createGain();
    if (fadeIn > 0) {
      gain.gain.setValueCurveAtTime(TANPURA_FADE_IN_CURVE, startTime, fadeIn);
    } else {
      gain.gain.setValueAtTime(1.0, startTime);
    }
    // After a value curve the param holds its final value, so the stretch
    // between the two curves stays at full level with no further scheduling.
    gain.gain.setValueCurveAtTime(
      TANPURA_FADE_OUT_CURVE, startTime + playDuration - fadeOut, fadeOut);

    source.connect(gain);
    gain.connect(this.droneGain);

    source.start(startTime, regionStart);
    source.stop(startTime + playDuration + 0.05);

    const entry = { source, gain };
    this.tanpuraSources.push(entry);
    source.onended = () => {
      const idx = this.tanpuraSources.indexOf(entry);
      if (idx > -1) this.tanpuraSources.splice(idx, 1);
    };

    // The next pass begins one crossfade before this one finishes, so its
    // equal-power fade-in mirrors this one's fade-out exactly.
    this.nextCycleTime = startTime + playDuration - fadeOut;
  }

  // --- Synthesised tanpura (Ni tuning, or when a sample is missing) ---

  droneScheduler() {
    if (!this.tanpuraPlaying || this.usingSampledTanpura) return;

    while (this.nextPluckTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.pluckTanpuraString(this.currentStringIndex, this.nextPluckTime);
      this.advanceDrone();
    }

    this.droneTimerId = setTimeout(() => this.droneScheduler(), this.lookahead);
  }

  advanceDrone() {
    // Tanpura plucking is deliberately not metronomic, and the fourth string is
    // allowed to ring on a little longer before the cycle comes round again.
    const isLastString = this.currentStringIndex === 3;
    const humanise = 1 + (Math.random() - 0.5) * 0.12;   // +/- 6%
    this.nextPluckTime += this.droneInterval * humanise * (isLastString ? 1.35 : 1);
    this.currentStringIndex = (this.currentStringIndex + 1) % 4;
  }

  /**
   * Additive synthesis with a jawari model.
   *
   * The jawari is the curved bridge the string grazes against. Its contact point
   * shifts as the string swings, which pumps energy into the upper partials *after*
   * the attack instead of letting them decay from it. Two consequences are modelled
   * here: partials bloom on a staggered delay (the cascade), and the emphasis peaks
   * around the 4th partial rather than at the fundamental.
   */
  pluckTanpuraString(stringIndex, time) {
    // The tanpura sits an octave below the lehra's reference Sa.
    const saFreq = this.saFrequency() / 2;

    let freq;
    if (stringIndex === 0) {
      freq = saFreq * Math.pow(2, this.getFirstStringOffset() / 12);
    } else if (stringIndex === 1 || stringIndex === 2) {
      freq = saFreq;        // the two madhya Sa strings
    } else {
      freq = saFreq / 2;    // mandra Sa
    }

    const PARTIALS = 22;
    const ringTime = stringIndex === 3 ? 8.5 : 6.5;   // strings overlap heavily

    for (let n = 1; n <= PARTIALS; n++) {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      // Mild inharmonicity from string stiffness, plus a little tuning drift.
      const stretch = 1 + 0.00016 * n * n;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * n * stretch, time);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 5, time);

      // Emphasis peaks near the 4th partial - harmonics dominate the fundamental.
      const emphasis = Math.exp(-Math.pow(Math.log(n / 4.0), 2) / 0.85);
      const amp = (emphasis / Math.sqrt(n)) * 0.06;

      // The cascade: higher partials arrive later and fade sooner.
      const bloom = 0.015 + (n / PARTIALS) * 0.30;
      const decay = ringTime * (1 - 0.6 * (n / PARTIALS));

      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.linearRampToValueAtTime(amp, time + bloom);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + bloom + decay);

      osc.connect(gainNode);
      gainNode.connect(this.droneGain);

      osc.start(time);
      osc.stop(time + bloom + decay + 0.1);

      this.tanpuraNodes.push(osc);
      osc.onended = () => {
        const idx = this.tanpuraNodes.indexOf(osc);
        if (idx > -1) this.tanpuraNodes.splice(idx, 1);
      };
    }
  }
}

// Create a globally accessible instance of the engine
const AudioEngine = new LehraAudioEngine();
