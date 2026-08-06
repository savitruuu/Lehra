# 🎵 Lehra – Tabla Practice Companion

A professional-quality, browser-based **Lehra (लहरा)** player and practice tool for Hindustani classical musicians. Lehra generates real-time melodic loops in authentic Raags, synced to a visual Taal tracker, Tanpura drone, and metronome — everything a Tabla student or performer needs for focused Riyaaz, in a single offline-capable web app.

---

## ✨ Features

### 🎹 Lehra Player
- **7 Sampled Instruments** — Harmonium, Bansuri (flute), Violin, Sitar, Santoor, Piano, and Guitar, each built from real recorded samples for authentic timbre.
- **12 Raags** — Kirwani, Des, Bhimpalasi, Janasammohini, Charukeshi, Jog, Darbari Kanada, Chandrakauns, Hansadhwani, Shuddha Saarang, Charukeshi 2, and Mishra.
- **Seamless Looping** — Precise Web Audio API scheduling ensures glitch-free, continuous playback across cycles.

### 🥁 Taal Support
| Taal | Matras | Vibhaags |
|------|--------|----------|
| Teentaal | 16 | 4-4-4-4 |
| Jhaptaal | 10 | 2-3-2-3 |

Each Taal includes full **Theka** notation, **Tali/Khali** positions, and a real-time visual beat tracker with animated **Sam indicator** (glow pulse on beat 1).

### 🪘 Tabla Theka
- **Real recorded strokes** — the theka of the active Taal, one bol per matra, played from single-stroke recordings
- **Composite bols** — Dha and Dhin are built from their two halves (bayan + dayan) exactly as they are played, rather than from one fixed recording
- **Tuned to your Sa** — the dayan follows the pitch selector; the bayan follows part of the way, as a player would retune it
- **Octave-aware** — from **F upwards the dayan takes the Sa an octave below**, so no scale stretches the recording more than four semitones. A real dayan has the same limit
- **Bols in Devanagari** — धा धिं धिं धा, as a tabla player reads a theka
- **Independent transport** — runs alone, or under the Lehra, on the same matra clock so both land on the same Sam
- Ring-out is capped against the matra, so a Dha decays naturally at Vilambit without piling up at Drut

### 🎚️ Tempo Control
- BPM range: **30 – 400 BPM**
- BPM slider, ±1 / ±5 buttons, and direct input
- **Tap Tempo** — tap the button rhythmically to auto-detect BPM
- **Laya presets** — Vilambit (60), Madhya (120), Drut (240)
- Smooth tempo changes during live playback

### 🎵 Pitch / Scale Control
- Full chromatic support: **C through B** (12 keys)
- Displays Safed/Kali (white/black key) labels for easy Harmonium reference
- Male and Female scale presets

### 🔊 Tanpura Drone
- **Real recorded Tanpura** samples (Sankalp Gulati / CompMusic project, CC BY 4.0)
- Sa–Pa and Sa–Ma first-string tunings
- Independent volume and speed controls
- Equal-power crossfade looping for seamless drone
- Can play independently or alongside the Lehra

### 🔔 Metronome
- Independent play/pause control
- Adjustable volume
- Syncs to the active Taal's beat structure

### 📊 Practice Analytics
- **Dashboard stats** — Total Riyaaz time, session count, most-practiced Taal, average BPM
- **Weekly distribution chart** — Custom HTML5 Canvas bar chart
- **Session logs** — Date, duration, Taal, BPM, and instrument for every practice run
- All data persisted in `localStorage`

### 🎙️ Session Recording
- Record your practice sessions directly in the browser
- Saved to **IndexedDB** for persistent local storage
- Playback, rename, and delete recordings from the Recordings screen

### ⏱️ Practice Timer
- Preset durations: 5, 10, 15, 30, 60 minutes, or Unlimited
- Elapsed time display on the player screen

### 🎨 Visual Beat Tracker — Avartan Chakra
- **The cycle drawn as a ring** — one dot per matra, Sam at twelve o'clock, and an arc that fills as the avartan turns, so position in the cycle and distance to Sam read as shape rather than as a number
- Vibhaag arcs are separated by gaps; the **khali** group stays hollow so the empty vibhaag is visible as emptiness
- Driven by the **matra clock, not the analyser** — it keeps tracking with the Lehra paused, for tabla-only practice
- Large beat number display with the current **bol**
- Vibhaag clap-pattern markers (e.g. `X | 2 | 0 | 3` for Teentaal)
- Animated Sam glow indicator

### ⚙️ Settings
- 🌗 Dark / Light theme toggle
- Default Taal, Instrument, and Pitch configuration
- Preferences saved to `localStorage`

### 📱 Responsive Design
- **Desktop** — Sidebar navigation with full dashboard layout
- **Mobile** — Fixed bottom navigation bar with compact header
- Works across all modern browsers

---

## 🏗️ Architecture

The app is a **static, single-page web application** — no build step, no framework, no backend required.

```
lehra-app/
├── index.html             # Single-page app shell with all screens
├── style.css              # Complete styling (dark/light themes, responsive)
├── taal_data.js           # Raag library, Taal definitions, pitch map
├── instruments.js         # Sampled instrument configuration & loading
├── tabla.js               # Tabla stroke set, bol map, theka sampler
├── tanpura-dsp.js         # Tanpura DSP synthesis (fallback engine)
├── tanpura-worker.js      # Web Worker for tanpura DSP processing
├── audio.js               # Web Audio engine (scheduling, playback, recording)
├── analytics.js           # Practice logging, stats, canvas charts
├── app.js                 # UI controller, navigation, event wiring
└── audio/
    ├── tanpura-pa-233.mp3 # Tanpura sample (Sa–Pa tuning)
    ├── tanpura-ma-233.mp3 # Tanpura sample (Sa–Ma tuning)
    ├── instruments/       # Sampled instrument recordings (per-note MP3s)
    └── tabla/             # Single tabla strokes (ge, ke, na, ta, tin, tu, te, re)
```

### Key Technical Details

- **Web Audio API** — All audio scheduling uses `AudioContext` with lookahead buffers for sample-accurate timing, even under browser tab throttling.
- **Sampled instruments** — One recording every 3 semitones (from MIDI 30–90), resampled via `playbackRate` to reach in-between notes. Sources include [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (MIT) and [VSCO2 Community Edition](https://vis.versilstudios.net/vsco-community.html) (CC BY 3.0).
- **Tanpura** — Dual engine: real recordings with equal-power crossfade looping (primary) and a Web Worker DSP synthesis engine (fallback).
- **Tabla** — Eight single strokes, mapped to bols and sequenced from each Taal's own theka array. The dayan is resampled onto the selected Sa (measured source tuning: 262.76 Hz), the bayan by the square root of that ratio since it is not a tuned drum. There is no synthesis fallback — the theka stays silent if the recordings fail to load.
- **Mix balance** — The four buses are levelled from measurement, not by ear. Each was rendered offline and read with gated A-weighted loudness, then trimmed to a reference balance: lehra 0 dB, tabla 0 dB, metronome −2 dB, tanpura −7 dB. Every slider shares one calibration (`MIX` in `audio.js`) and defaults to the same position, so levelling them returns you to that balance. The seven lehra instruments are matched to within 0.01 dB of each other, so changing instrument changes the timbre and not the volume. A master limiter catches the sum when every slider is pushed to 100%.
- **Raag data** — Swaras stored as semitone offsets from Sa (0), with sub-beat arrays for ornamental patterns (e.g., `[5, null, 4, 5]` = Mā—Gā Mā).
- **Persistence** — `localStorage` for settings and practice logs; `IndexedDB` for recorded audio blobs.

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, Safari)
- A local HTTP server (required for audio sample loading)

### Run Locally

1. **Clone or download** the repository:
   ```bash
   git clone https://github.com/your-username/lehra-app.git
   cd lehra-app
   ```

2. **Start a local server** — any of these will work:
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js (npx)
   npx serve .

   # VS Code
   # Install the "Live Server" extension → right-click index.html → "Open with Live Server"
   ```

3. **Open** `http://localhost:8000` in your browser.

> **Note:** Opening `index.html` directly as a `file://` URL will not work because browsers block audio file loading from the local filesystem for security reasons.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause Lehra |
| `↑` / `↓` | Increase / Decrease volume |
| Media Play/Pause | Play / Pause Lehra |

---

## 🎯 Target Users

- Tabla students and professionals
- Hindustani classical vocalists and instrumentalists
- Music teachers and academies
- Anyone practicing Hindustani classical music

---

## 🗺️ Roadmap

### Phase 2 (Planned)
- AI tempo detection via microphone
- Sam accuracy analysis
- Lay consistency tracking
- Additional Taals (Ektaal, Rupak, Dadra, Keherwa)
- Cloud sync and user accounts

### Phase 3 (Future)
- Custom Lehra composer
- Community Lehra sharing
- Teacher / Student mode
- Online backup

---

## 🙏 Credits & Attributions

- **Tanpura recordings** by [Sankalp Gulati](https://freesound.org/people/sankalp/packs/9571/) — recorded at Dhrupad Sansar, IIT Bombay for the CompMusic project. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Tabla strokes** by [msarkar](https://freesound.org/people/msarkar/packs/3571/) — the "tabla bols" pack on Freesound. Licensed under [CC Sampling Plus 1.0](https://creativecommons.org/licenses/sampling+/1.0/), which permits use of the samples in new works, and non-commercial redistribution of the samples themselves.
- **Violin samples** from [Versilian Studios Chamber Orchestra 2 (Community Edition)](https://vis.versilstudios.net/vsco-community.html) via [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments). Licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- **Instrument soundfonts** from [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (MusyngKite & FluidR3_GM banks). Licensed under [MIT](https://opensource.org/licenses/MIT).

---

## 📄 License

This project is provided as-is for educational and personal use. See individual asset licenses above for third-party content.
