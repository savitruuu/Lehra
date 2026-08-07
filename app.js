/**
 * Lehra Application Controller
 * Coordinates UI events, Canvas animations and practice logging.
 */

// Global state variables. Counts up while the lehra plays and is banked into the
// practice log on pause - see startPracticeTimer. Nothing displays it.
let practiceSeconds = 0;
let practiceTimerInterval = null;

let visualizerAnimationId = null;

// --- App Bootstrap ---
document.addEventListener("DOMContentLoaded", async () => {
  // Load defaults from local storage
  loadSettingsDefaults();

  // Populate Taal Glossary UI
  populateTaalGlossary();

  // Warm the tanpura recordings now, off the critical path, so the drone is
  // already decoded and ready by the time Play is first pressed - not awaited,
  // since it just needs to finish sometime before the user gets there.
  AudioEngine.preloadTanpuraSamples();

  // Same for the tabla strokes - only about 160KB, and having them decoded up
  // front is what lets the theka start on the beat instead of after a fetch.
  AudioEngine.preloadTablaSamples();

  // Same for the lehra instrument. Only the selected one is decoded up front;
  // the others load when they are picked, and until then that instrument falls
  // back to its synthesised voice rather than going silent.
  const startingInstrument = document.getElementById("instrument-select");
  if (startingInstrument) AudioEngine.preloadInstrument(startingInstrument.value);

  // These six steps are independent of each other, but they used to run as a
  // bare sequence - so a throw in any one of them silently abandoned every step
  // after it. That is precisely how a stray word in analytics.js left the
  // player with no vibhaag markers and no visualiser: the failure was three
  // steps upstream and nothing on screen said so. Isolate them, and report
  // anything that breaks instead of losing the rest of the UI with it.
  const safeInit = (name, fn) => {
    try {
      fn();
    } catch (e) {
      console.error(`Lehra: ${name}() failed - continuing without it.`, e);
    }
  };

  safeInit("initNavigation", initNavigation);
  safeInit("initPlayerControls", initPlayerControls);
  // After initPlayerControls: this moves elements that controls above have
  // already bound listeners to, and reads the engine state they just set.
  safeInit("initMobileLayout", initMobileLayout);
  safeInit("initSettings", initSettings);
  safeInit("initAnalyticsUI", initAnalyticsUI);
  safeInit("initKeyboardControls", initKeyboardControls);

  // Populate the initial vibhaag clap pattern
  safeInit("updateVibhaagMarkers", updateVibhaagMarkers);

  // Initialize Canvas Visualizer Setup
  safeInit("setupCanvasVisualizer", setupCanvasVisualizer);

  // Handle mobile drawer click overlay close
  window.addEventListener("resize", () => {
    // Redraw charts/canvas on resize
    if (document.getElementById("analytics-screen").classList.contains("active")) {
      renderWeeklyPracticeChart("analytics-chart");
    }
  });
});

// --- View Router Navigation ---
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item, .mobile-nav-item");
  const screens = document.querySelectorAll(".screen");

  // The player is active on load.
  document.body.classList.add("player-active");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetScreenId = item.getAttribute("data-target");

      // Update active nav state
      navItems.forEach(i => {
        if (i.getAttribute("data-target") === targetScreenId) {
          i.classList.add("active");
        } else {
          i.classList.remove("active");
        }
      });

      // The player is the one screen pinned to a single viewport; the rest
      // still scroll, so the stylesheet needs to know which is showing.
      document.body.classList.toggle("player-active", targetScreenId === "player-screen");

      // Switch active screen
      screens.forEach(screen => {
        if (screen.id === targetScreenId) {
          screen.classList.add("active");
          
          // Execute screen-specific loaders
          if (targetScreenId === "analytics-screen") {
            loadAnalyticsDashboard();
          }
        } else {
          screen.classList.remove("active");
        }
      });
    });
  });
}

// --- Player Settings & Core Logic ---
function initPlayerControls() {
  const playBtn = document.getElementById("play-btn");
  const playIcon = document.getElementById("play-icon");
  const taalSelect = document.getElementById("taal-select");
  const instrumentSelect = document.getElementById("instrument-select");
  const raagSelect = document.getElementById("raag-select");
  const pitchSelect = document.getElementById("pitch-select");
  const tanpuraPlayBtn = document.getElementById("tanpura-play-btn");
  const tanpuraPlayIcon = document.getElementById("tanpura-play-icon");
  const metronomePlayBtn = document.getElementById("metronome-play-btn");
  const tablaPlayBtn = document.getElementById("tabla-play-btn");

  const lehraVol = document.getElementById("lehra-volume");
  const metroVol = document.getElementById("metronome-volume");
  const tablaVol = document.getElementById("tabla-volume");
  const tablaVolVal = document.getElementById("tabla-volume-val");

  const tanpuraVol = document.getElementById("tanpura-volume");
  const tanpuraVolVal = document.getElementById("tanpura-volume-val");
  const tanpuraSpeed = document.getElementById("tanpura-speed");
  const tanpuraSpeedVal = document.getElementById("tanpura-speed-val");

  const lehraVolVal = document.getElementById("lehra-volume-val");
  const metroVolVal = document.getElementById("metronome-volume-val");

  const bpmSlider = document.getElementById("bpm-slider");
  const bpmVal = document.getElementById("bpm-val");
  const bpmMinus = document.getElementById("bpm-minus");
  const bpmMinus5 = document.getElementById("bpm-minus-5");
  const bpmPlus = document.getElementById("bpm-plus");
  const bpmPlus5 = document.getElementById("bpm-plus-5");
  const bpmHalf = document.getElementById("bpm-half");
  const bpmDouble = document.getElementById("bpm-double");

  // Sync initial select configs with AudioEngine
  AudioEngine.activeTaalKey = taalSelect.value;
  AudioEngine.instrument = instrumentSelect.value;
  AudioEngine.pitch = pitchSelect.value;
  AudioEngine.bpm = parseInt(bpmSlider.value);
  window._activeRaagKey = raagSelect ? raagSelect.value : "kirwani";

  // Sync callbacks
  AudioEngine.onBeatCallback = handleOnBeat;

  // Sync Slider volumes. Every bus goes through mixGain(), so the four sliders
  // share one calibration - see MIX in audio.js. All of them default to the
  // same position, and that position is the balanced mix.
  const bindVolume = (input, readout, bus, node) => {
    input.addEventListener("input", (e) => {
      const val = e.target.value;
      readout.textContent = val + "%";
      const target = AudioEngine[node];
      if (target) {
        target.gain.setValueAtTime(mixGain(bus, val), AudioEngine.ctx.currentTime);
      }
    });
  };

  bindVolume(lehraVol, lehraVolVal, "lehra", "lehraGain");
  bindVolume(metroVol, metroVolVal, "metronome", "metronomeGain");
  bindVolume(tablaVol, tablaVolVal, "tabla", "tablaGain");

  const updateRaagOptionsForTaal = () => {
    if (!raagSelect) return;
    const currentTaalKey = taalSelect.value;
    const taalMatras = TAAL_DATA[currentTaalKey] ? TAAL_DATA[currentTaalKey].matras : 16;
    
    // Save current selection if possible
    const currentRaag = raagSelect.value;

    raagSelect.innerHTML = "";
    let firstAvailable = null;

    Object.keys(RAAG_LIBRARY).forEach(key => {
      const raag = RAAG_LIBRARY[key];
      // Include raag if it has a specific lehra sequence for this matra count
      if (raag.lehra && raag.lehra[taalMatras]) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = raag.name;
        raagSelect.appendChild(option);
        if (!firstAvailable) firstAvailable = key;
      }
    });

    if (Array.from(raagSelect.options).some(opt => opt.value === currentRaag)) {
      raagSelect.value = currentRaag;
    } else if (firstAvailable) {
      raagSelect.value = firstAvailable;
    }
    window._activeRaagKey = raagSelect.value;
  };

  // Select events
  taalSelect.addEventListener("change", (e) => {
    AudioEngine.activeTaalKey = e.target.value;
    updateRaagOptionsForTaal();
    updateVibhaagMarkers();
    updatePlaybackStatusText();
  });

  // Initial populate of raag options based on active taal
  updateRaagOptionsForTaal();

  // Switching instrument waits for that instrument's recordings.
  //
  // AudioEngine.instrument used to be reassigned the moment the select changed,
  // with preloadInstrument left running unawaited behind it. In the gap between
  // the two, playSampled found nothing decoded under the new key and fell
  // through to playInstrumentTone - so every switch announced itself with a beat
  // or two of a synthesised voice that sounds nothing like the instrument being
  // chosen. Holding the previous instrument until the new one is actually
  // playable is the fix: what sounds in the meantime is the instrument that was
  // already going, rather than a third thing that was never picked.
  //
  // sampler.load() resolves from cache once an instrument has been decoded, so
  // this only ever waits the first time each one is chosen. It resolves null
  // rather than rejecting when every sample fails, and the assignment still
  // happens on that path - the synthesised voice is the intended fallback when
  // there are genuinely no recordings, just not a thing to pass through on the
  // way to a working one.
  let instrumentLoadToken = 0;
  const chooseInstrument = async (key) => {
    const token = ++instrumentLoadToken;

    // The readout names what is selected rather than what is sounding, so it
    // moves now - it reads the label off the select, not off the engine.
    updatePlaybackStatusText();

    await AudioEngine.preloadInstrument(key);

    // A quick second pick while the first was still decoding: the older load
    // must not install itself over the newer choice.
    if (token !== instrumentLoadToken) return;
    AudioEngine.instrument = key;
  };

  instrumentSelect.addEventListener("change", (e) => {
    chooseInstrument(e.target.value);
  });

  if (raagSelect) {
    raagSelect.addEventListener("change", (e) => {
      window._activeRaagKey = e.target.value;
      // Reset matra index for a clean loop start
      AudioEngine.currentMatraIndex = 0;
      if (instrumentSelect && instrumentSelect.value) {
        AudioEngine.preloadInstrument(instrumentSelect.value);
      }
      updatePlaybackStatusText();
    });
  }

  pitchSelect.addEventListener("change", (e) => {
    AudioEngine.pitch = e.target.value;

    // A new scale starts centred - any fine-tune bend belonged to the scale
    // just left, not to this one.
    AudioEngine.pitchCents = 0;
    const fineSlider = document.getElementById("pitch-fine");
    if (fineSlider) {
      fineSlider.value = 0;
      refreshRangeFill(fineSlider);
    }

    // A running sampled drone is pitched by playbackRate, so it has to be
    // rebuilt to follow the new scale.
    AudioEngine.retuneTanpura();
    updatePlaybackStatusText();
  });

  // --- Tanpura drone ---
  // Independent of the main play button - toggled only from its own button
  // here, so it can keep droning through a lehra pause or run on its own
  // while practising tabla without the lehra.
  // Sa-Pa, fixed. The Sa-Ma tuning is for raags that drop Pa, and none of the
  // lehras this app ships do - so the choice was a control that existed to be
  // left alone. The engine still supports both; nothing but this line picks.
  AudioEngine.tanpuraDroneType = "pa";
  AudioEngine.setTanpuraTempo(100 / parseInt(tanpuraSpeed.value));

  tanpuraPlayBtn.addEventListener("click", async () => {
    if (AudioEngine.tanpuraPlaying) {
      AudioEngine.stopTanpura();
    } else {
      await AudioEngine.startTanpura();
      applyTanpuraVolume(tanpuraVol.value);
    }
    syncTanpuraButton();
    updateTanpuraSourceNote();
  });

  // --- Metronome click ---
  // Independent of both the Lehra play button and the Tanpura button - it can
  // run alone (tabla practice with no melody) or alongside either.
  metronomePlayBtn.addEventListener("click", () => {
    if (AudioEngine.metronomeIsPlaying) {
      AudioEngine.stopMetronome();
    } else {
      AudioEngine.startMetronome();
    }
    syncMetronomeButton();
  });

  // --- Tabla theka ---
  // Same arrangement as the metronome: its own transport, the shared matra
  // clock. Practise the lehra against it, or run it alone with the tanpura.
  tablaPlayBtn.addEventListener("click", async () => {
    if (AudioEngine.tablaIsPlaying) {
      AudioEngine.stopTabla();
      syncTablaButton();
      return;
    }

    // Starting waits on the recordings, which are normally already warm from
    // the preload at boot. Disable the button rather than let a second click
    // queue a second start behind the first.
    tablaPlayBtn.disabled = true;
    const started = await AudioEngine.startTabla();
    tablaPlayBtn.disabled = false;

    syncTablaButton();
    if (!started) updateTablaSourceNote(true);
  });

  // A tempo never seen before takes a brief moment to compute in the
  // background (it runs off the main thread, so nothing freezes and the drone
  // keeps playing at the old tempo meanwhile) - these just let the slider say
  // so instead of looking unresponsive. Once computed it's cached, so
  // revisiting the same value later is instant.
  AudioEngine.onTanpuraStretchEnd = () => {
    tanpuraSpeedVal.textContent = tanpuraSpeed.value + "%";
  };

  tanpuraVol.addEventListener("input", (e) => {
    tanpuraVolVal.textContent = e.target.value + "%";
    applyTanpuraVolume(e.target.value);
  });

  tanpuraSpeed.addEventListener("input", (e) => {
    tanpuraSpeedVal.textContent = e.target.value + "%";
  });

  // Applied on release rather than on every input event: a tempo change may
  // need to build a new time-stretched buffer, which is too heavy to redo
  // continuously mid-drag. The build itself runs in a background Worker, so it
  // does not block the UI or the currently-playing audio either way.
  tanpuraSpeed.addEventListener("change", (e) => {
    AudioEngine.setTanpuraTempo(100 / parseInt(e.target.value));
    applyTanpuraVolume(tanpuraVol.value);
  });

  // BPM Control events
  const updateBpm = (val) => {
    val = Math.max(30, Math.min(400, val));
    bpmSlider.value = val;
    bpmVal.textContent = val + " BPM";
    AudioEngine.bpm = val;
    updatePlaybackStatusText();
    syncLayaButtons(val);
    refreshRangeFill(bpmSlider);
  };

  bpmSlider.addEventListener("input", (e) => {
    updateBpm(parseInt(e.target.value));
  });

  bpmMinus.addEventListener("click", () => {
    updateBpm(AudioEngine.bpm - 1);
  });

  bpmMinus5.addEventListener("click", () => {
    updateBpm(AudioEngine.bpm - 5);
  });

  bpmPlus.addEventListener("click", () => {
    updateBpm(AudioEngine.bpm + 1);
  });

  bpmPlus5.addEventListener("click", () => {
    updateBpm(AudioEngine.bpm + 5);
  });

  // Halving and doubling are how a laya is actually stepped in practice - the
  // same lehra at half and at double speed - so they are one tap rather than a
  // long run on the -5/+5 pair. Rounded because an odd BPM halves to a fraction,
  // and the clamp in updateBpm keeps both inside 30-400.
  if (bpmHalf) bpmHalf.addEventListener("click", () => updateBpm(Math.round(AudioEngine.bpm / 2)));
  if (bpmDouble) bpmDouble.addEventListener("click", () => updateBpm(Math.round(AudioEngine.bpm * 2)));

  // Preset BPM Buttons
  document.getElementById("laya-vilambit").addEventListener("click", () => updateBpm(60));
  document.getElementById("laya-madhya").addEventListener("click", () => updateBpm(120));
  document.getElementById("laya-drut").addEventListener("click", () => updateBpm(240));

  // Reflect the tempo the app actually starts on, and paint every slider's
  // filled portion for the values restored from settings.
  syncLayaButtons(AudioEngine.bpm);
  refreshAllRangeFills();

  // Main Play Button Toggle
  playBtn.addEventListener("click", async () => {
    if (AudioEngine.isPlaying) {
      // Pause. The tanpura is independent - it keeps droning unless the user
      // stops it from its own button in the mixer.
      AudioEngine.stop();
      playIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
      playBtn.classList.remove("playing");
      stopPracticeTimer();
    } else {
      // Start Playback
      AudioEngine.start();

      // No analyser is created here any more. It existed only to feed the
      // waveform the tracker used to draw; the avartan chakra runs off the
      // matra clock instead, so tapping the master output for amplitude would
      // be a node connected to nothing that reads it.

      playIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
      playBtn.classList.add("playing");
      startPracticeTimer();
    }

    // Starts the countdown to the screensaver, or cancels it on pause.
    noteActivity();
  });
}

// --- Tanpura helpers ---
function applyTanpuraVolume(percent) {
  if (AudioEngine.droneGain && AudioEngine.ctx) {
    AudioEngine.droneGain.gain.setValueAtTime(
      mixGain("tanpura", percent), AudioEngine.ctx.currentTime);
  }
}

// Keeps the mixer's tanpura button showing the true engine state, whether it was
// started from that button or carried along by the main play button.
function syncTanpuraButton() {
  const icon = document.getElementById("tanpura-play-icon");
  if (!icon) return;

  const playing = AudioEngine.tanpuraPlaying;
  icon.innerHTML = playing
    ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`
    : `<path d="M8 5v14l11-7z"/>`;

  const btn = document.getElementById("tanpura-play-btn");
  if (btn) btn.setAttribute("aria-label", playing ? "Pause Tanpura" : "Play Tanpura");

  noteActivity();
}

function syncMetronomeButton() {
  const icon = document.getElementById("metronome-play-icon");
  if (!icon) return;

  const playing = AudioEngine.metronomeIsPlaying;
  icon.innerHTML = playing
    ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`
    : `<path d="M8 5v14l11-7z"/>`;

  const btn = document.getElementById("metronome-play-btn");
  if (btn) btn.setAttribute("aria-label", playing ? "Pause Metronome" : "Play Metronome");

  noteActivity();
}

function syncTablaButton() {
  const icon = document.getElementById("tabla-play-icon");
  if (!icon) return;

  const playing = AudioEngine.tablaIsPlaying;
  icon.innerHTML = playing
    ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`
    : `<path d="M8 5v14l11-7z"/>`;

  const btn = document.getElementById("tabla-play-btn");
  if (btn) btn.setAttribute("aria-label", playing ? "Pause Tabla" : "Play Tabla");

  noteActivity();
}

// Only ever says anything when the recordings could not be loaded. There is no
// synthesised tabla to fall back to, so silence would otherwise go unexplained.
function updateTablaSourceNote(failed = false) {
  const note = document.getElementById("tabla-source-note");
  if (!note) return;
  note.textContent = failed
    ? "Tabla recordings could not be loaded - serve the app over http rather than opening the file directly."
    : "";
}

// Tells the user whether they are hearing the recording or the synth fallback,
// since the Ni tuning has no recording available.
function updateTanpuraSourceNote() {
  const note = document.getElementById("tanpura-source-note");
  if (!note) return;

  // Only worth saying something when the recording is NOT what's playing.
  if (AudioEngine.tanpuraPlaying && !AudioEngine.usingSampledTanpura) {
    note.textContent = "No recording for this tuning — using the synthesised tanpura.";
  } else {
    note.textContent = "";
  }
}

// --- Vibhaag clap pattern (Sam / Tali / Khali) ---

/**
 * The sign shown for the matra that opens a vibhaag:
 *   X  Sam, the first beat of the cycle
 *   0  Khali, the open-hand wave
 *   n  a tali (clap), labelled with the matra it lands on rather than with
 *      which tali it is - so Teentaal reads X 5 0 13, not X 2 0 3.
 */
function vibhaagSign(taal, matraNumber) {
  if (matraNumber === 1) return "X";
  if (taal.khali_positions.includes(matraNumber)) return "0";
  if (taal.tali_positions.includes(matraNumber)) return String(matraNumber);
  return "-";
}

/** Which vibhaag a given matra falls inside. */
function vibhaagIndexForMatra(taal, matraNumber) {
  let acc = 0;
  for (let i = 0; i < taal.vibhaags.length; i++) {
    acc += taal.vibhaags[i];
    if (matraNumber <= acc) return i;
  }
  return taal.vibhaags.length - 1;
}

function updateVibhaagMarkers() {
  const row = document.getElementById("vibhaag-markers");
  if (!row) return;
  row.innerHTML = "";

  const taal = TAAL_DATA[AudioEngine.activeTaalKey];
  let matra = 1;

  taal.vibhaags.forEach((vibhaagLength, vIdx) => {
    const sign = vibhaagSign(taal, matra);
    const mark = document.createElement("div");
    mark.classList.add("vibhaag-mark");
    mark.id = `vibhaag-mark-${vIdx}`;
    mark.textContent = sign;
    if (sign === "X") mark.classList.add("sam");
    else if (sign === "0") mark.classList.add("khali");
    mark.title = `Matra ${matra}`;
    row.appendChild(mark);
    matra += vibhaagLength;
  });
}

// Update status text below play button
function updatePlaybackStatusText() {
  const taal = TAAL_DATA[AudioEngine.activeTaalKey];
  const raag = RAAG_LIBRARY[window._activeRaagKey] || RAAG_LIBRARY.kirwani;
  const title = document.getElementById("status-taal-title");
  const desc = document.getElementById("status-laya-desc");

  title.textContent = `${raag.name} – ${taal.name}`;
  
  let laya = "Madhya Laya";
  if (AudioEngine.bpm < 90) laya = "Vilambit Laya";
  else if (AudioEngine.bpm > 180) laya = "Drut Laya";

  const instrSelect = document.getElementById("instrument-select");
  const instrLabel = instrSelect ? instrSelect.options[instrSelect.selectedIndex].text : "";
  desc.textContent = `${instrLabel} • Scale ${AudioEngine.pitch} • ${laya}`;
}

// --- Session length ---
//
// What is left of the practice timer, which has no interface any more: no clock
// on screen, and no session-limit dropdown that stopped the transport and put an
// alert in front of the player. After thirty seconds of undisturbed playing the
// screensaver takes the screen, and a running clock is the one thing a musician
// does not need in front of them while it does.
//
// The count itself stays, because it is not really a timer - it is the source
// the Analytics screen reads for total practice time, session count and the
// weekly chart. It runs while the lehra plays and is banked on pause.
function startPracticeTimer() {
  practiceSeconds = 0;
  practiceTimerInterval = setInterval(() => {
    practiceSeconds++;
  }, 1000);
}

function stopPracticeTimer() {
  clearInterval(practiceTimerInterval);

  // Anything under five seconds is a mis-tap, not a session.
  if (practiceSeconds > 5) {
    savePracticeSession(
      practiceSeconds,
      AudioEngine.activeTaalKey,
      AudioEngine.bpm,
      AudioEngine.instrument
    );
  }

  practiceSeconds = 0;
}

/**
 * Where the avartan tracker is, as a fractional matra index.
 *
 * The scheduler only calls back once per matra, which is enough to move a
 * number but not to sweep an arc, so the wall clock fills in between: each
 * callback stamps the moment it landed, and the tracker interpolates from
 * there at the current tempo. Deliberately not read from AudioContext time -
 * the callbacks are already delivered on the main thread at the audio moment,
 * so this stays in the same clock as the frames that draw it.
 */
let lastBeatIndex = 0;
let lastBeatAt = 0;

function avartanPosition() {
  const taal = TAAL_DATA[AudioEngine.activeTaalKey];
  if (!transportIsRunning() || !lastBeatAt) return lastBeatIndex % taal.matras;

  const beatDuration = 60 / AudioEngine.bpm;
  const elapsed = (performance.now() - lastBeatAt) / 1000;

  // Clamped rather than allowed to run on: if the tab is throttled or a beat
  // callback is late, the arc waits at the matra it last knew about instead of
  // sprinting ahead of the tabla and then snapping back.
  const frac = Math.max(0, Math.min(1, elapsed / beatDuration));
  return (lastBeatIndex % taal.matras) + frac;
}

/** True while anything is driving the matra clock - lehra, tabla or click. */
function transportIsRunning() {
  return AudioEngine.isPlaying || AudioEngine.metronomeIsPlaying || AudioEngine.tablaIsPlaying;
}

// --- Scheduler Beat Event Callbacks ---
function handleOnBeat(matraIndex) {
  const matraNumber = matraIndex + 1;
  const taal = TAAL_DATA[AudioEngine.activeTaalKey];

  lastBeatIndex = matraIndex;
  lastBeatAt = performance.now();

  // Update big beat display
  const beatNum = document.getElementById("beat-num");
  const beatLabel = document.getElementById("beat-label");
  beatNum.textContent = matraNumber;

  // Sam still gets its gold pulse - that is a visual cue, not part of the label.
  if (matraNumber === 1) {
    const samGlow = document.getElementById("sam-glow");
    samGlow.classList.add("active");
    setTimeout(() => samGlow.classList.remove("active"), 300);
  }

  // Only the tabla bol here. Sam, tali and khali are already carried by the
  // vibhaag markers below, so repeating them would just be noise.
  // Falls back to a non-breaking space so an absent theka cannot collapse the row.
  //
  // Shown in English/Latin, which matches the theka arrays.
  const bol = taal.theka && taal.theka[matraIndex];
  beatLabel.textContent = bol ? bol : " ";
  beatLabel.title = bol || "";

  // Light up the vibhaag the current matra belongs to.
  document.querySelectorAll(".vibhaag-mark").forEach(mark => {
    mark.classList.remove("active");
  });

  const activeMark = document.getElementById(
    `vibhaag-mark-${vibhaagIndexForMatra(taal, matraNumber)}`);
  if (activeMark) {
    activeMark.classList.add("active");
  }
}

// --- Avartan Chakra ---
/**
 * The cycle drawn as a ring: one dot per matra, Sam at twelve o'clock, and an
 * arc that fills as the avartan turns.
 *
 * This replaced an analyser waveform wrapped around the same circle. A waveform
 * carries amplitude, which is the one thing a taal tracker does not need - it
 * read identically at matra 3 and matra 14, so the matra number underneath was
 * doing all the work, and a number has to be read rather than glanced at. The
 * ring puts position in the cycle and distance to Sam into the shape itself.
 *
 * It is driven by the matra clock rather than the analyser, which also means it
 * keeps tracking with the lehra paused - practising tabla against the theka
 * alone used to leave a still circle.
 *
 * The centre stays in the DOM (.beat-display): the matra number, the bol and
 * the vibhaag markers are already styled, themed and responsive there, and
 * canvas text would only duplicate them worse.
 */
function setupCanvasVisualizer() {
  const canvas = document.getElementById("visualizer");
  const ctx = canvas.getContext("2d");

  // setTransform rather than scale: scale compounds every time it is applied to
  // the same context, so resizing repeatedly used to shrink the drawing.
  // Assigning canvas.width also clears the bitmap, so only ever do it when the
  // size has genuinely changed - this runs on every frame.
  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // getComputedStyle is not free and the ring needs six colours a frame, so the
  // palette is read once and kept until the theme actually changes.
  let palette = null;
  let paletteTheme = null;
  const readPalette = () => {
    const theme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    if (palette && paletteTheme === theme) return palette;
    paletteTheme = theme;
    palette = {
      line:     getThemeColor("--panel-border") || "rgba(255,255,255,0.08)",
      mint:     getThemeColor("--accent-cyan") || "#89d7b7",
      gold:     getThemeColor("--accent-gold") || "#fbbf24",
      muted:    getThemeColor("--text-muted") || "#5a8a7a",
      mintGlow: getThemeColor("--accent-cyan-glow") || "#89d7b7",
      goldGlow: getThemeColor("--accent-gold-glow") || "#fbbf24"
    };
    return palette;
  };

  function draw() {
    visualizerAnimationId = requestAnimationFrame(draw);

    // On phones the tracker sits inside the screensaver, which is laid out even
    // while invisible - so the size check below would pass and the ring would be
    // redrawn every frame at nobody.
    if (!trackerIsOnScreen()) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;

    resizeCanvas();
    ctx.clearRect(0, 0, width, height);

    const taal = TAAL_DATA[AudioEngine.activeTaalKey];
    if (!taal) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.75;
    const TOP = -Math.PI / 2;

    const position = avartanPosition();
    const currentIndex = Math.floor(position) % taal.matras;

    const { line, mint, gold, muted, mintGlow, goldGlow } = readPalette();

    // Vibhaag arcs, broken by a small gap so the clap groups read as groups.
    // The khali vibhaag is drawn thinner - the same "deliberately dimmer"
    // treatment its marker below already uses.
    let matra = 1;
    taal.vibhaags.forEach(vibhaagLength => {
      const isKhali = taal.khali_positions.includes(matra);
      const a0 = TOP + ((matra - 1) / taal.matras) * Math.PI * 2 + 0.045;
      const a1 = TOP + ((matra - 1 + vibhaagLength) / taal.matras) * Math.PI * 2 - 0.045;

      ctx.strokeStyle = line;
      ctx.lineWidth = isKhali ? 1 : 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, a0, a1);
      ctx.stroke();

      matra += vibhaagLength;
    });

    // How far round the ring the avartan has come.
    ctx.strokeStyle = mint;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, TOP, TOP + (position / taal.matras) * Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // One dot per matra.
    for (let i = 0; i < taal.matras; i++) {
      const angle = TOP + (i / taal.matras) * Math.PI * 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      const isSam = i === 0;
      const isCurrent = i === currentIndex;
      const hasPassed = i < currentIndex;
      const inKhali = taal.khali_positions.includes(
        vibhaagStartMatra(taal, vibhaagIndexForMatra(taal, i + 1)));

      ctx.beginPath();
      ctx.arc(x, y, isCurrent ? 8.5 : isSam ? 6 : 4.5, 0, Math.PI * 2);

      if (isCurrent) {
        ctx.fillStyle = isSam ? gold : mint;
        ctx.shadowColor = isSam ? goldGlow : mintGlow;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (inKhali) {
        // Khali matras stay hollow whether or not they have gone by, so the
        // empty vibhaag is visible as emptiness.
        ctx.strokeStyle = hasPassed ? mint : muted;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (hasPassed) {
        ctx.fillStyle = mint;
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = isSam ? gold : muted;
        ctx.globalAlpha = isSam ? 0.85 : 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  draw();
}

/** First matra of a vibhaag, 1-indexed - the matra its tali or khali falls on. */
function vibhaagStartMatra(taal, vibhaagIndex) {
  let matra = 1;
  for (let i = 0; i < vibhaagIndex; i++) matra += taal.vibhaags[i];
  return matra;
}

// ============================================================
//  PHONE LAYOUT
// ============================================================
/**
 * The phone player is one screen with no scrolling, so several controls that
 * the desktop layout shows at once have to live somewhere else: the mixer
 * behind bottom sheets, the beat tracker inside the screensaver, and the odds
 * and ends behind the hamburger.
 *
 * None of that is a second copy of the markup. There is one #taal-select, one
 * record button, one avartan chakra; this file moves the real elements between
 * their desktop home and their phone home, and moves them back if the viewport
 * grows. Listeners, values and IDs survive a move, so nothing downstream - the
 * audio engine, the beat callbacks, the analytics - needs to know which layout
 * is showing.
 */
const MOBILE_MQ = window.matchMedia("(max-width: 99999px)");

// The dial's range, low to high. Not the chromatic order starting at C - it is
// arranged so the dial simply clamps at each end instead of wrapping: G is the
// lowest Sa the up/down buttons will reach, F# the highest.
const SCALE_STEP_ORDER = ["G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#"];

// Which select belongs to which launcher tile, and where its current value is
// echoed. The tile shows the label; the value line under it is the option the
// select is already on, which the tile would otherwise hide.
const TILE_SELECTS = [
  { select: "taal-select", tile: "tile-taal", value: "tile-taal-value" },
  { select: "raag-select", tile: "tile-raag", value: "tile-raag-value" },
  { select: "instrument-select", tile: "tile-instrument", value: "tile-instrument-value" }
];

const _relocations = [];

/**
 * Remembers where an element lives on desktop, so it can be sent to
 * `mobileParent` at the phone breakpoint and put back afterwards.
 *
 * The desktop position is recorded as (parent, nextSibling) rather than as an
 * index: the whitespace text nodes around it stay put, so re-inserting before
 * the same sibling restores the original order exactly.
 */
function registerRelocation(el, mobileParent) {
  if (!el || !mobileParent) return;
  _relocations.push({
    el,
    mobileParent,
    deskParent: el.parentNode,
    deskNext: el.nextSibling
  });
}

function applyLayoutRelocations() {
  const mobile = MOBILE_MQ.matches;
  _relocations.forEach(r => {
    if (mobile) {
      if (r.el.parentNode !== r.mobileParent) r.mobileParent.appendChild(r.el);
    } else if (r.el.parentNode !== r.deskParent || r.el.nextSibling !== r.deskNext) {
      r.deskParent.insertBefore(r.el, r.deskNext);
    }
  });
}

// --- Drawer, scrim and mixer sheets ---

function closeOverlays(skipHistory = false) {
  const drawer = document.getElementById("app-drawer");
  const scrim = document.getElementById("app-scrim");
  const openBtn = document.getElementById("drawer-open-btn");

  const drawerWasOpen = drawer && drawer.classList.contains("open");
  const sheetWasOpen = document.querySelectorAll(".mix-sheet.open").length > 0;
  const pickerWasOpen = document.getElementById("tile-picker") !== null;

  if (drawer) drawer.classList.remove("open");
  if (openBtn) openBtn.setAttribute("aria-expanded", "false");
  document.querySelectorAll(".mix-sheet.open").forEach(s => s.classList.remove("open"));
  if (scrim) scrim.classList.remove("open");
  closeTilePicker();

  // If any overlay was open, and we aren't responding to a back button pop state,
  // pop the dummy state to keep the history clean.
  if (!skipHistory && (drawerWasOpen || sheetWasOpen || pickerWasOpen)) {
    if (window.history.state && window.history.state.overlay) {
      window.history.back();
    }
  }
}

function pushOverlayHistoryState() {
  // Push a dummy state so the mobile hardware back button triggers popstate instead of exiting the app.
  if (!window.history.state || !window.history.state.overlay) {
    window.history.pushState({ overlay: true }, "");
  }
}

function openDrawer() {
  closeOverlays();
  const drawer = document.getElementById("app-drawer");
  const scrim = document.getElementById("app-scrim");
  const openBtn = document.getElementById("drawer-open-btn");

  if (drawer) drawer.classList.add("open");
  if (openBtn) openBtn.setAttribute("aria-expanded", "true");
  if (scrim) scrim.classList.add("open");
  pushOverlayHistoryState();
}

function openSheet(sheetId) {
  const sheet = document.getElementById(sheetId);
  if (!sheet) return;

  closeOverlays();
  sheet.classList.add("open");
  const scrim = document.getElementById("app-scrim");
  if (scrim) scrim.classList.add("open");
  pushOverlayHistoryState();
}

// Popstate listener to handle hardware back button closes
window.addEventListener("popstate", (e) => {
  const drawer = document.getElementById("app-drawer");
  const drawerOpen = drawer && drawer.classList.contains("open");
  const sheetOpen = document.querySelectorAll(".mix-sheet.open").length > 0;
  const pickerOpen = document.getElementById("tile-picker") !== null;

  if (drawerOpen || sheetOpen || pickerOpen) {
    closeOverlays(true);
  }
});

// --- Scale dial ---

/**
 * Moves the scale a semitone, through the same select the desktop layout uses.
 * Clamps at either end of SCALE_STEP_ORDER rather than wrapping - past F# the
 * up button simply stops doing anything, and likewise for down past G.
 */
function stepScale(delta) {
  const select = document.getElementById("pitch-select");
  if (!select) return;

  const index = SCALE_STEP_ORDER.indexOf(select.value);
  if (index < 0) return;

  const next = Math.max(0, Math.min(SCALE_STEP_ORDER.length - 1, index + delta));
  if (next === index) return;

  select.value = SCALE_STEP_ORDER[next];
  // Dispatched rather than called directly, so the existing change handler in
  // initPlayerControls stays the single place that retunes the engine.
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function syncScaleDisplay() {
  const select = document.getElementById("pitch-select");
  const note = document.getElementById("scale-note-display");
  const freq = document.getElementById("scale-freq-display");
  const cents = document.getElementById("scale-cents-display");

  if (note && select) note.textContent = select.value;
  if (freq) freq.textContent = AudioEngine.saFrequency().toFixed(1) + " Hz";
  if (cents) cents.textContent = formatCents(AudioEngine.pitchCents || 0);
}

/** "0" at rest, otherwise signed - "+12" or "-8", never a bare "12". */
function formatCents(c) {
  if (!c) return "0";
  return (c > 0 ? "+" : "") + c;
}

/** Moves the fine-tune slider by `delta` cents, clamped to its own range. */
function stepFineTune(delta) {
  const fine = document.getElementById("pitch-fine");
  if (!fine) return;

  const min = parseInt(fine.min, 10);
  const max = parseInt(fine.max, 10);
  const next = Math.max(min, Math.min(max, (parseInt(fine.value, 10) || 0) + delta));
  if (next === (parseInt(fine.value, 10) || 0)) return;

  fine.value = next;
  refreshRangeFill(fine);
  AudioEngine.pitchCents = next;
  syncScaleDisplay();
  // A discrete step, not a drag - commits immediately the way the slider's own
  // "change" (release) does, rather than waiting for one.
  AudioEngine.retuneTanpura();
}

// --- Launcher tiles ---

function syncTileValues() {
  TILE_SELECTS.forEach(cfg => {
    const select = document.getElementById(cfg.select);
    const out = document.getElementById(cfg.value);
    if (!select || !out) return;
    const opt = select.options[select.selectedIndex];
    out.textContent = opt ? opt.text : "";
  });
}

/**
 * Anchored option list for the Taal / Raag / Instrument tiles.
 *
 * The three underlying <select> elements stay in the DOM and stay the source
 * of truth - this only replaces how their list is presented on a phone. Left
 * to the platform, tapping a <select> opens a picker that claims the whole
 * screen; this instead pops a small panel right off the tile that was tapped,
 * sized to its options rather than to the viewport. Choosing a row sets the
 * real select's value and dispatches a real "change" event, so every existing
 * listener - the taal/raag/instrument handlers in initPlayerControls,
 * syncTileValues below - fires exactly as it would from the native control.
 */
let _tilePickerPanel = null;
let _tilePickerSelect = null;

function ensureTilePickerPanel() {
  if (_tilePickerPanel) return _tilePickerPanel;
  const panel = document.createElement("div");
  panel.className = "tile-picker";
  panel.setAttribute("role", "listbox");
  document.body.appendChild(panel);
  _tilePickerPanel = panel;
  return panel;
}

function closeTilePicker() {
  if (_tilePickerPanel) _tilePickerPanel.classList.remove("open");
  _tilePickerSelect = null;
}

function openTilePicker(select, tile) {
  const panel = ensureTilePickerPanel();
  _tilePickerSelect = select;
  panel.innerHTML = "";

  Array.from(select.options).forEach(opt => {
    const row = document.createElement("div");
    row.className = "tile-picker-option";
    if (opt.value === select.value) row.classList.add("selected");
    row.textContent = opt.text;
    row.addEventListener("click", () => {
      if (select.value !== opt.value) {
        select.value = opt.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      closeTilePicker();
    });
    panel.appendChild(row);
  });

  panel.classList.add("open");
  pushOverlayHistoryState();

  // Anchored to the tile and clamped to the viewport, rather than centred or
  // full-screen: it opens "from that place itself" and never claims more room
  // than its own option list needs.
  const rect = tile.getBoundingClientRect();
  const width = Math.max(rect.width, 200);
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
  panel.style.width = width + "px";
  panel.style.left = Math.max(8, left) + "px";

  const GAP = 6;     // between the tile and the panel
  const MARGIN = 8;  // smallest gap left against the viewport edge

  // Five options at a time; the rest is a scroll.
  //
  // This is what keeps the panel on screen. Raag is sixteen options on
  // Teentaal, and at full height that ran off the bottom from a tile sitting in
  // the middle of the card. Capping the list is a better answer than flipping
  // the panel above the tile: a picker that sometimes opens upward and
  // sometimes downward is harder to aim at than one that always does the same
  // thing, and five rows is enough to show that the list continues.
  //
  // Measured off a real row rather than assumed, so it survives a change to the
  // option padding or the type size.
  const VISIBLE = 5;
  panel.style.maxHeight = "none";
  let wanted = panel.scrollHeight;

  if (panel.children.length > VISIBLE) {
    const cs = getComputedStyle(panel);
    const gap = parseFloat(cs.rowGap) || 0;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const row = panel.children[0].getBoundingClientRect().height;
    wanted = VISIBLE * row + (VISIBLE - 1) * gap + pad;
  }

  // Downward, always. The clamp below is a floor rather than a second placement
  // rule: on a handset short enough that five rows do not fit under the tile,
  // fewer show and the scroll covers the difference - still better than running
  // off the bottom of the screen.
  const roomBelow = window.innerHeight - rect.bottom - GAP - MARGIN;
  panel.style.maxHeight = Math.max(96, Math.min(wanted, roomBelow)) + "px";
  panel.style.top = (rect.bottom + GAP) + "px";
  panel.style.bottom = "auto";
}

// --- Screensaver ---

const SCREENSAVER_DELAY_MS = 30000;
let screensaverTimer = null;

/**
 * True when the avartan chakra is actually on screen.
 *
 * On phones the tracker is parked inside the hidden screensaver, which is laid
 * out but invisible - so the canvas still reports a size and the draw loop
 * would happily burn a frame on it every 16ms for nothing. The loop checks this
 * instead.
 */
function trackerIsOnScreen() {
  if (!MOBILE_MQ.matches) return true;
  const screensaver = document.getElementById("screensaver");
  return !!screensaver && screensaver.classList.contains("active");
}

function hideScreensaver() {
  const el = document.getElementById("screensaver");
  if (el) el.classList.remove("active");
}

/**
 * Restarts the countdown to the screensaver.
 *
 * Called when the transport changes and on any touch or key, so the countdown
 * measures playing that the user has left alone - the graphic never takes over
 * while a slider is still being dragged.
 */
function noteActivity() {
  clearTimeout(screensaverTimer);
  screensaverTimer = null;
  hideScreensaver();

  if (!MOBILE_MQ.matches || !transportIsRunning()) return;

  screensaverTimer = setTimeout(() => {
    if (!MOBILE_MQ.matches || !transportIsRunning()) return;
    const el = document.getElementById("screensaver");
    if (el) el.classList.add("active");
  }, SCREENSAVER_DELAY_MS);
}

// --- Laya presets ---

// The three preset buttons are a readout as well as a control: whichever one
// matches the current tempo is the laya being practised, however the tempo got
// there - slider, steppers, half/double or the preset itself. Anything between
// two presets leaves all three unlit rather than rounding to the nearest, since
// 137 BPM is not Madhya laya in any useful sense.
const LAYA_PRESETS = [
  { id: "laya-vilambit", bpm: 60 },
  { id: "laya-madhya", bpm: 120 },
  { id: "laya-drut", bpm: 240 }
];

function syncLayaButtons(bpm) {
  LAYA_PRESETS.forEach(p => {
    const el = document.getElementById(p.id);
    if (el) el.classList.toggle("active", bpm === p.bpm);
  });
}

// --- Range slider fill ---

// A range input paints one flat track either side of its thumb, with no way in
// CSS alone to colour only the travelled part. The stylesheet draws the track as
// a two-stop gradient instead and reads the stop position from --fill, which is
// all this keeps up to date.
function refreshRangeFill(input) {
  if (!input) return;
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max);
  const span = (isNaN(max) ? 100 : max) - min;
  const pct = span > 0 ? ((parseFloat(input.value) - min) / span) * 100 : 0;
  input.style.setProperty("--fill", Math.max(0, Math.min(100, pct)) + "%");
}

function refreshAllRangeFills() {
  document.querySelectorAll('input[type="range"]').forEach(refreshRangeFill);
}

// Covers every drag, and every programmatic change that dispatches a bubbling
// "input" the way the volume keyboard shortcuts do. The few places that set a
// value without dispatching call refreshRangeFill themselves.
document.addEventListener("input", (e) => {
  if (e.target && e.target.type === "range") refreshRangeFill(e.target);
});

// A backstop for the startup path: the saved defaults are written straight onto
// the sliders during init, some without dispatching, so this repaints all of
// them once everything has settled.
window.addEventListener("load", refreshAllRangeFills);

// --- Custom range slider drag behavior ---
// Restricts slider movement so it ONLY moves when the thumb (sliding circle) is held and dragged.
// Tapping/clicking outside the thumb hit area is ignored. Sensitivity is reduced for finer control.
(function initCustomSliderDrag() {
  const SENSITIVITY = 0.65; // Reduced sensitivity factor (65% of standard 1:1 pointer speed)

  document.addEventListener("pointerdown", (e) => {
    const input = e.target;
    if (!input || input.tagName !== "INPUT" || input.type !== "range" || input.disabled) return;

    const rect = input.getBoundingClientRect();
    if (rect.width <= 0) return;

    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const span = max - min;
    if (span <= 0) return;

    const val = parseFloat(input.value);
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const thumbWidth = isCoarse ? 28 : 20;
    const usableWidth = Math.max(1, rect.width - thumbWidth);

    const ratio = (val - min) / span;
    const thumbX = rect.left + (thumbWidth / 2) + ratio * usableWidth;

    const dxFromThumb = Math.abs(e.clientX - thumbX);
    const hitRadius = (thumbWidth / 2) + 12; // Radius around thumb center considered a valid grab

    // If pointer down is outside the sliding circle, ignore it so track clicks do not move the slider
    if (dxFromThumb > hitRadius) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Pointer is holding the sliding circle: initiate controlled drag
    e.preventDefault();

    const startX = e.clientX;
    const startValue = val;
    const step = parseFloat(input.step) || 1;
    const pointerId = e.pointerId;

    try {
      input.setPointerCapture(pointerId);
    } catch (_) {}

    const onPointerMove = (moveEv) => {
      if (moveEv.pointerId !== pointerId) return;
      const dx = moveEv.clientX - startX;
      // Reduced sensitivity calculation
      const deltaVal = (dx / usableWidth) * span * SENSITIVITY;
      let rawVal = startValue + deltaVal;

      rawVal = Math.max(min, Math.min(max, rawVal));
      let newValue = Math.round((rawVal - min) / step) * step + min;
      newValue = Math.max(min, Math.min(max, newValue));

      if (parseFloat(input.value) !== newValue) {
        input.value = newValue;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    const onPointerUp = (upEv) => {
      if (upEv.pointerId !== pointerId) return;
      input.removeEventListener("pointermove", onPointerMove);
      input.removeEventListener("pointerup", onPointerUp);
      input.removeEventListener("pointercancel", onPointerUp);
      try {
        input.releasePointerCapture(pointerId);
      } catch (_) {}
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    input.addEventListener("pointermove", onPointerMove);
    input.addEventListener("pointerup", onPointerUp);
    input.addEventListener("pointercancel", onPointerUp);
  }, true);
})();

// --- Wiring ---

function initMobileLayout() {
  const drawer = document.getElementById("app-drawer");
  const scrim = document.getElementById("app-scrim");
  const screensaver = document.getElementById("screensaver");
  const heroWrap = document.getElementById("scale-hero-wrap");

  // The three pickers move onto their tile, label and all - the select stays
  // there as the value store, but stays hidden (see .tile select in the
  // stylesheet); tapping the tile opens the anchored list in openTilePicker
  // above instead of the platform's own full-screen one.
  TILE_SELECTS.forEach(cfg => {
    const select = document.getElementById(cfg.select);
    const tile = document.getElementById(cfg.tile);
    if (!select || !tile) return;

    const label = document.querySelector(`label[for="${cfg.select}"]`);
    if (label) registerRelocation(label, tile);
    registerRelocation(select, tile);
    select.addEventListener("change", syncTileValues);
    tile.addEventListener("click", () => openTilePicker(select, tile));
  });

  registerRelocation(document.getElementById("fine-tune-row"), heroWrap);
  registerRelocation(document.getElementById("visual-tracker"), screensaver);

  // .drawer-extras is empty now that the record button and the practice-timer
  // dropdown are gone - it hides itself with :empty, and is left in place as the
  // slot for anything the player card cannot hold in future.
  registerRelocation(document.getElementById("laya-timer-row"), document.getElementById("laya-slot"));

  // Lehra's own level moves under the tempo slider - no play button of its
  // own, since the main Play button already covers it.
  registerRelocation(document.getElementById("lehra-volume-block"), document.getElementById("lehra-volume-slot"));

  // Mixer cells: the play button + heading for each of Tanpura, Tabla and
  // Metronome, then that instrument's own volume slider, landing in that
  // order in its cell - the right column of the launcher grid.
  const cellTanpura = document.getElementById("mixer-cell-tanpura");
  const cellMetronome = document.getElementById("mixer-cell-metronome");
  const cellTabla = document.getElementById("mixer-cell-tabla");

  registerRelocation(document.getElementById("tanpura-mix-head"), cellTanpura);
  registerRelocation(document.getElementById("tanpura-volume-block"), cellTanpura);
  registerRelocation(document.getElementById("metronome-mix-head"), cellMetronome);
  registerRelocation(document.getElementById("metronome-volume-block"), cellMetronome);
  registerRelocation(document.getElementById("tabla-mix-head"), cellTabla);
  registerRelocation(document.getElementById("tabla-volume-block"), cellTabla);

  applyLayoutRelocations();

  MOBILE_MQ.addEventListener("change", () => {
    applyLayoutRelocations();
    closeOverlays();
    noteActivity();
  });

  // Drawer
  const openBtn = document.getElementById("drawer-open-btn");
  const closeBtn = document.getElementById("drawer-close-btn");
  if (openBtn) openBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeOverlays);
  if (scrim) scrim.addEventListener("click", closeOverlays);
  if (drawer) {
    drawer.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", closeOverlays);
    });
  }

  // Tanpura's First String and Speed stay behind a sheet, same as before -
  // only its play button and volume moved out to the mini mixer. The heading
  // is the tap target rather than the whole row, so it doesn't fight with the
  // play button sitting right next to it.
  const tanpuraHeading = document.getElementById("tanpura-heading");
  if (tanpuraHeading) tanpuraHeading.addEventListener("click", () => openSheet("sheet-tanpura"));

  document.querySelectorAll(".mix-sheet .sheet-handle").forEach(handle => {
    handle.addEventListener("click", closeOverlays);
  });

  // Scale dial
  const scaleDown = document.getElementById("scale-down");
  const scaleUp = document.getElementById("scale-up");
  const scaleOrb = document.getElementById("scale-orb");
  const pitchSelect = document.getElementById("pitch-select");
  if (scaleDown) scaleDown.addEventListener("click", () => stepScale(-1));
  if (scaleUp) scaleUp.addEventListener("click", () => stepScale(1));
  // Same anchored list as the tiles above, opened against #pitch-select
  // directly - a straight pick, alongside the arrows for a step at a time.
  if (scaleOrb && pitchSelect) {
    scaleOrb.addEventListener("click", () => openTilePicker(pitchSelect, scaleOrb));
  }
  if (pitchSelect) pitchSelect.addEventListener("change", syncScaleDisplay);

  // Micro scale adjuster. The engine reads pitchCents on every note, so the
  // lehra and the tabla follow the slider as it moves; the sampled tanpura has
  // to be rebuilt at the new rate, which is why that waits for release. The
  // +/- buttons commit immediately, the way releasing the slider does.
  const fine = document.getElementById("pitch-fine");
  const fineMinus = document.getElementById("fine-minus");
  const finePlus = document.getElementById("fine-plus");
  if (fine) {
    AudioEngine.pitchCents = parseInt(fine.value, 10) || 0;

    fine.addEventListener("input", (e) => {
      AudioEngine.pitchCents = parseInt(e.target.value, 10) || 0;
      syncScaleDisplay();
    });

    fine.addEventListener("change", () => {
      AudioEngine.retuneTanpura();
    });
  }
  if (fineMinus) fineMinus.addEventListener("click", () => stepFineTune(-1));
  if (finePlus) finePlus.addEventListener("click", () => stepFineTune(1));

  // Any touch or key postpones the screensaver; a touch while it is showing
  // dismisses it. Capture phase so it is seen before anything swallows it.
  document.addEventListener("pointerdown", (e) => {
    const screensaverActive = trackerIsOnScreen();
    noteActivity();
    if (screensaverActive) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  document.addEventListener("keydown", noteActivity, true);

  // A tap anywhere outside the open picker closes it - including on a
  // different tile, which then opens its own picker right after. Capture
  // phase, ahead of the tile's own click listener, so that sequence lands as
  // "close, then open the new one" rather than "open, immediately closed".
  document.addEventListener("pointerdown", (e) => {
    if (!_tilePickerSelect) return;
    if (_tilePickerPanel && _tilePickerPanel.contains(e.target)) return;
    closeTilePicker();
  }, true);

  syncScaleDisplay();
  syncTileValues();
}

// --- Analytics Dashboard loader ---
function loadAnalyticsDashboard() {
  const stats = calculateAnalyticsStats();
  
  document.getElementById("stat-total-time").textContent = stats.totalMinutes + "m";
  document.getElementById("stat-total-sessions").textContent = stats.totalSessions;
  document.getElementById("stat-favorite-taal").textContent = stats.favoriteTaal;
  document.getElementById("stat-avg-bpm").textContent = stats.avgBpm > 0 ? stats.avgBpm : "0";

  // Load log list
  const logListContainer = document.getElementById("analytics-log-list");
  const logs = getPracticeLogs().reverse().slice(0, 5); // top 5 recent

  if (logs.length > 0) {
    logListContainer.innerHTML = "";
    logs.forEach(log => {
      const logDate = new Date(log.date).toLocaleDateString();
      const mins = Math.round(log.duration / 60);
      const taalName = TAAL_DATA[log.taal] ? TAAL_DATA[log.taal].name : log.taal;
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.justify = "space-between";
      item.style.padding = "10px";
      item.style.background = "rgba(0, 0, 0, 0.15)";
      item.style.border = "1px solid var(--panel-border)";
      item.style.borderRadius = "8px";
      item.style.fontSize = "14px";
      item.innerHTML = `
        <span><strong>${taalName}</strong> (${log.bpm} BPM)</span>
        <span style="color: var(--accent-cyan);">${mins > 0 ? mins : 1} min • ${logDate}</span>
      `;
      logListContainer.appendChild(item);
    });
  }

  // Draw chart
  renderWeeklyPracticeChart("analytics-chart");
}


// --- Settings configuration values ---
function initSettings() {
  const saveBtn = document.getElementById("settings-save-btn");
  const themeToggle = document.getElementById("settings-theme-toggle");

  // Load current theme state
  themeToggle.checked = document.body.classList.contains("dark-mode");

  themeToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  });

  saveBtn.addEventListener("click", () => {
    const defaultTaal = document.getElementById("settings-default-taal").value;
    const defaultRaag = document.getElementById("settings-default-raag").value;
    const defaultInstrument = document.getElementById("settings-default-instrument").value;
    const defaultPitch = document.getElementById("settings-default-pitch").value;

    const config = {
      theme: themeToggle.checked ? "dark" : "light",
      taal: defaultTaal,
      raag: defaultRaag,
      instrument: defaultInstrument,
      pitch: defaultPitch
    };

    localStorage.setItem("lehra_user_settings", JSON.stringify(config));
    alert("Defaults saved successfully!");
  });
}

function loadSettingsDefaults() {
  const configStr = localStorage.getItem("lehra_user_settings");
  if (!configStr) return;

  try {
    const config = JSON.parse(configStr);

    if (config.theme === "dark") {
      document.body.classList.add("dark-mode");
      document.getElementById("settings-theme-toggle").checked = true;
    }

    // Set player defaults
    if (config.taal) {
      document.getElementById("taal-select").value = config.taal;
      document.getElementById("settings-default-taal").value = config.taal;
    }
    // Written onto #raag-select before initPlayerControls runs, which is what
    // makes it stick: updateRaagOptionsForTaal rebuilds that list from the taal
    // and keeps whatever is already selected, as long as the raag has a lehra
    // for this taal's matra count. If it does not, the saved raag is genuinely
    // unplayable here and the first available one wins - same rule as switching
    // taal by hand.
    if (config.raag) {
      document.getElementById("raag-select").value = config.raag;
      document.getElementById("settings-default-raag").value = config.raag;
    }
    if (config.instrument) {
      document.getElementById("instrument-select").value = config.instrument;
      document.getElementById("settings-default-instrument").value = config.instrument;
    }
    if (config.pitch) {
      document.getElementById("pitch-select").value = config.pitch;
      document.getElementById("settings-default-pitch").value = config.pitch;
    }
  } catch(e) {
    console.error("Error setting defaults", e);
  }
}

// --- Populate Taal glossary info screen ---
function populateTaalGlossary() {
  const container = document.getElementById("taal-info-list");
  container.innerHTML = "";

  for (const key in TAAL_DATA) {
    const taal = TAAL_DATA[key];
    const card = document.createElement("div");
    card.classList.add("glass-panel", "taal-info-card");
    
    // Tali/Khali formatting
    const taliStr = taal.tali_positions.join(", ");
    const khaliStr = taal.khali_positions.join(", ");
    // English/Latin bol names for the theka display.
    const thekaStr = taal.theka
      ? taal.theka.join(" ")
      : "N/A";
    const thekaLatin = taal.theka ? taal.theka.join(" · ") : "";

    card.innerHTML = `
      <div class="taal-info-header">
        <span>${taal.name}</span>
        <span style="color: var(--accent-gold); font-size: 14px;">${taal.matras} Beats</span>
      </div>
      <p style="font-size: 14px; margin-bottom: 4px; color: var(--text-primary);">
        <strong>Theka:</strong> <span class="bol-deva" style="font-size: 19px;">${thekaStr}</span>
      </p>
      <p class="theka-latin">${thekaLatin}</p>
      <div class="taal-details-list">
        <div class="taal-details-item">Vibhaags (Divisions): <strong>${taal.vibhaags.join("-")}</strong></div>
        <div class="taal-details-item">Tali Beats: <strong>${taliStr || "None"}</strong></div>
        <div class="taal-details-item">Khali Beats: <strong>${khaliStr || "None"}</strong></div>
      </div>
    `;
    container.appendChild(card);
  }
}

function initAnalyticsUI() {
  // Try loading default empty chart on boot
  loadAnalyticsDashboard();
}

// --- Keyboard Controls & Media Key Shortcuts ---
function initKeyboardControls() {
  window.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const isTextInput = active && (
      (active.tagName === "INPUT" && (
        active.type === "text" ||
        active.type === "search" ||
        active.type === "number" ||
        active.type === "password" ||
        active.type === "email" ||
        !active.type
      )) ||
      active.tagName === "TEXTAREA" ||
      active.isContentEditable
    );

    const isRangeInput = active && active.tagName === "INPUT" && active.type === "range";

    // 1. Play / Pause via Space bar or Hardware Media Play/Pause button
    const isSpace = (e.code === "Space" || e.key === " " || e.key === "Spacebar");
    const isMediaPlayPause = (
      e.code === "MediaPlayPause" ||
      e.key === "MediaPlayPause" ||
      e.key === "MediaPlay" ||
      e.key === "MediaPause" ||
      e.key === "Play" ||
      e.key === "Pause" ||
      e.code === "MediaStop" ||
      e.key === "MediaStop"
    );

    if (isMediaPlayPause || (isSpace && !isTextInput)) {
      e.preventDefault();
      
      const playBtn = document.getElementById("play-btn");
      const tanpuraPlayBtn = document.getElementById("tanpura-play-btn");
      const tablaPlayBtn = document.getElementById("tabla-play-btn");
      const metronomePlayBtn = document.getElementById("metronome-play-btn");

      // Check which components are currently playing
      const lehraActive = AudioEngine && AudioEngine.isPlaying;
      const tanpuraActive = AudioEngine && AudioEngine.tanpuraPlaying;
      const tablaActive = AudioEngine && AudioEngine.tablaIsPlaying;
      const metronomeActive = AudioEngine && AudioEngine.metronomeIsPlaying;

      const anyActive = lehraActive || tanpuraActive || tablaActive || metronomeActive;

      if (anyActive) {
        // Toggle off all currently playing sound modules
        if (lehraActive && playBtn) playBtn.click();
        if (tanpuraActive && tanpuraPlayBtn) tanpuraPlayBtn.click();
        if (tablaActive && tablaPlayBtn) tablaPlayBtn.click();
        if (metronomeActive && metronomePlayBtn) metronomePlayBtn.click();
      } else {
        // If nothing is playing, start main Lehra (or main Play button)
        if (playBtn) playBtn.click();
      }
      return;
    }

    // 2. Volume Up / Down via hardware Volume buttons or ArrowUp / ArrowDown / +/-
    const isHardwareVolUp = e.key === "AudioVolumeUp" || e.key === "VolumeUp";
    const isHardwareVolDown = e.key === "AudioVolumeDown" || e.key === "VolumeDown";

    const isArrowOrPlusVolUp = !isTextInput && !isRangeInput && (e.key === "ArrowUp" || e.key === "+" || e.key === "=");
    const isArrowOrMinusVolDown = !isTextInput && !isRangeInput && (e.key === "ArrowDown" || e.key === "-" || e.key === "_");

    const isVolUp = isHardwareVolUp || isArrowOrPlusVolUp;
    const isVolDown = isHardwareVolDown || isArrowOrMinusVolDown;

    if (isVolUp || isVolDown) {
      e.preventDefault();

      const step = 5;

      // Identify active playing components to target their volume inputs
      const activeTargets = [];
      if (AudioEngine && AudioEngine.isPlaying) {
        const el = document.getElementById("lehra-volume");
        if (el) activeTargets.push(el);
      }
      if (AudioEngine && AudioEngine.tablaIsPlaying) {
        const el = document.getElementById("tabla-volume");
        if (el) activeTargets.push(el);
      }
      if (AudioEngine && AudioEngine.metronomeIsPlaying) {
        const el = document.getElementById("metronome-volume");
        if (el) activeTargets.push(el);
      }
      if (AudioEngine && AudioEngine.tanpuraPlaying) {
        const el = document.getElementById("tanpura-volume");
        if (el) activeTargets.push(el);
      }

      // If nothing is currently playing, default to adjusting the main Lehra volume slider
      if (activeTargets.length === 0) {
        const defaultEl = document.getElementById("lehra-volume");
        if (defaultEl) activeTargets.push(defaultEl);
      }

      // Adjust volume slider for all active components
      activeTargets.forEach((sliderEl) => {
        const currentVal = parseInt(sliderEl.value, 10) || 0;
        const newVol = isVolUp ? Math.min(100, currentVal + step) : Math.max(0, currentVal - step);
        sliderEl.value = newVol;
        sliderEl.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
  });

  // MediaSession API integration for OS/keyboard media controls
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => {
        const playBtn = document.getElementById("play-btn");
        if (playBtn && typeof AudioEngine !== "undefined" && !AudioEngine.isPlaying) {
          playBtn.click();
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        const playBtn = document.getElementById("play-btn");
        if (playBtn && typeof AudioEngine !== "undefined" && AudioEngine.isPlaying) {
          playBtn.click();
        }
      });
    } catch (err) {
      console.warn("MediaSession action handlers setup warning:", err);
    }
  }
}

