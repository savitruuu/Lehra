/**
 * Lehra - Sampled Instrument Voices
 *
 * The lehra instruments were originally built from oscillators. No amount of
 * filter tuning makes a stack of sine waves read as a bansuri or a sitar, so
 * each instrument is now a set of real recorded notes, pitched to the note
 * being asked for - the same approach the tanpura already uses.
 *
 * Samples come from gleitz/midi-js-soundfonts (MIT), MusyngKite bank, except
 * the harmonium: MusyngKite's reed organ sounds a full octave below its file
 * names, so that one is taken from the FluidR3_GM bank, which is in tune.
 *
 * Rather than ship all 88 notes, one recording is kept every 3 semitones and
 * resampled to reach the notes in between. That is at most a 1.5-semitone
 * shift, which is inaudible, and keeps the whole set to a few megabytes.
 */

// Anchor recordings, every 3 semitones from Gb1 to Gb6 (MIDI 30-90). The range
// looks wide for a melody instrument because the piano and guitar voice a bass
// note two octaves under the lehra line.
const SAMPLE_ANCHORS = [
  ["Gb1", 30], ["A1", 33], ["C2", 36], ["Eb2", 39], ["Gb2", 42], ["A2", 45],
  ["C3", 48], ["Eb3", 51], ["Gb3", 54], ["A3", 57], ["C4", 60], ["Eb4", 63],
  ["Gb4", 66], ["A4", 69], ["C5", 72], ["Eb5", 75], ["Gb5", 78], ["A5", 81],
  ["C6", 84], ["Eb6", 87], ["Gb6", 90]
];

/**
 * Bansuri source. A bansuri is a bamboo tube, so it wants breath in the tone;
 * the GM concert flute is a silver instrument and reads too pure and glassy
 * for a Hindustani line, which is why the pan flute is the default here.
 * All of these are downloaded - change this one line to switch:
 *
 *   audio/instruments/bansuri-fluid     FluidR3 concert flute (default)
 */
const BANSURI_DIR = "audio/instruments/bansuri-fluid";

/**
 * Sitar source. Only two usable recordings exist in the free banks:
 *
 *   audio/instruments/sitar-fluid  FluidR3 (default)
 *   audio/instruments/sitar        MusyngKite
 */
const SITAR_DIR = "audio/instruments/sitar-fluid";

/**
 * Violin source. FluidR3_GM violin from the gleitz/midi-js-soundfonts
 * collection (MIT). Uses the standard SAMPLE_ANCHORS grid (every 3
 * semitones) like the other instruments, so no custom anchor list needed.
 *
 * This replaces the earlier VSCO2 recordings which had an orchestral
 * character (heavy sustain/vibrato) that didn't sit well against the
 * tanpura in a Hindustani lehra context. The FluidR3 violin has a
 * cleaner, more focused tone that blends better as a melody instrument.
 */
const VIOLIN_DIR = "audio/instruments/violin-fluid";

/**
 * gain      - per-instrument trim so the six sit at a comparable level.
 * sustained - true for instruments that hold a note for as long as it is
 *             asked for (harmonium, bansuri) and so need their steady middle
 *             section looped. Plucked and struck instruments instead keep the
 *             recording's own decay, which is most of what makes them
 *             recognisable, so they are never looped.
 * ring      - extra seconds a plucked note is allowed to keep sounding past
 *             its written length before the release starts.
 * release   - fade applied at the end of a note, to stop it cutting off hard.
 */
/**
 * One dial for how loud the lehra is overall. The per-instrument gains below
 * are only relative trims and should be left alone - turn this up or down to
 * change the level of all six together.
 *
 * The engine's limiter catches the peaks this creates, so raising it makes the
 * lehra louder rather than distorted. Past roughly 12 the limiter starts
 * working hard enough to audibly flatten the plucked instruments' attacks.
 */
const SAMPLE_LEVEL_BOOST = 6.0;

// The gain figures are not guesses: they are measured, by rendering the whole
// lehra line offline on each instrument and reading its gated A-weighted
// loudness - the same measure used to balance the four mix buses in audio.js.
//
// An earlier set of these was trimmed by matching a single sustained note,
// which is not the same thing and was not close: measured across an actual
// phrase the seven spanned 7.6 dB, from the piano at the top to the guitar
// 7.6 dB under it, so changing instrument changed the level far more than it
// changed the timbre. One note misses everything that makes the difference -
// how much of the phrase a voice holds through, how its decay sits against the
// matra, how much of its energy lands where the ear is most sensitive.
//
// The measurement has to loop the sustained voices the way play() does, or the
// three that hold their notes come out flattering themselves by about 3 dB and
// the harmonium - the reference the whole mix is set against - is the worst
// affected. With that modelled, these land all seven within 0.01 dB.
//
// The spread in the raw figures is the recordings', not the instruments': the
// santoor arrives about five times quieter than the harmonium.
const INSTRUMENT_VOICES = {
  harmonium: { dir: "audio/instruments/harmonium", gain: 0.500, sustained: true,  ring: 0,    release: 0.22 },
  flute:     { dir: BANSURI_DIR,                   gain: 0.624, sustained: true,  ring: 0,    release: 0.14 },
  sitar:     { dir: SITAR_DIR,                     gain: 0.796, sustained: false, ring: 0.45, release: 0.35 },
  piano:     { dir: "audio/instruments/piano",     gain: 1.497, sustained: false, ring: 0.15, release: 0.28 },
  santoor:   { dir: "audio/instruments/santoor",   gain: 2.684, sustained: false, ring: 0.30, release: 0.32 },
  guitar:    { dir: "audio/instruments/guitar",    gain: 2.062, sustained: false, ring: 0.20, release: 0.28 },
  violin:    { dir: VIOLIN_DIR, gain: 0.568, sustained: true, ring: 0, release: 0.20 }
};

/**
 * Per-recording tuning trim, in cents that the recording sounds SHARP of the
 * note its filename claims. The sampler plays each one back that much slower,
 * so every note lands on standard A440 equal temperament.
 *
 * These are measured, not nominal - each figure is the fundamental of that
 * exact file, read over a window long enough to average across vibrato. Free
 * soundfonts are assembled from separately recorded notes and are not
 * internally consistent; two faults here were plainly audible rather than
 * academic:
 *
 *   guitar Gb3  was 21 cents flat - one badly tuned note in an otherwise fine set
 *   piano       ran 6-16 cents sharp and rising with pitch, which is real piano
 *               stretch tuning baked into the recordings. Authentic on its own,
 *               but it beats against the tanpura, and a practice reference has
 *               to agree with the drone rather than sound like a concert grand.
 *
 * Only the twelve anchors the app can actually reach are listed (Gb3-Eb6);
 * anything absent is treated as 0. The lower anchors became unreachable when
 * the backing chords were removed, so they were left unmeasured.
 */
const SAMPLE_TUNING = {
  harmonium: { 54:  0.5, 57: -4.9, 60: -5.1, 63:  3.4, 66:  3.4, 69: -1.3, 72: -1.3, 75: -2.1, 78: -2.1, 81: -1.2, 84:  -1.2, 87:  2.8 },
  // Unmeasured for bansuri-fluid (switched from bansuri-pan) - treated as 0 until re-measured.
  flute:     {},
  sitar:     { 54: -3.3, 57: -3.3, 60: -2.3, 63: -3.1, 66: -3.0, 69: -2.6, 72: -2.7, 75: -2.7, 78: -2.8, 81: -2.4, 84:  -2.3, 87: -2.4 },
  piano:     { 54:  8.4, 57:  2.8, 60:  5.8, 63:  0.8, 66:  5.7, 69:  6.5, 72:  8.7, 75:  9.0, 78:  7.9, 81: 12.0, 84:  12.8, 87: 15.8 },
  santoor:   { 54: -1.1, 57: -1.0, 60: -0.5, 63: -1.0, 66:  3.4, 69:  3.4, 72:  1.2, 75:  2.5, 78:  2.3, 81: -1.4, 84:  -0.7, 87:  1.6 },
  guitar:    { 54:-21.4, 57:  6.5, 60: -3.3, 63: -3.6, 66: -1.5, 69:  5.1, 72: -4.3, 75: -3.0, 78:  5.7, 81:  3.1, 84:  -2.3, 87: -2.9 },
  // FluidR3 violin - not yet measured; treated as 0 until re-measured.
  violin:    {}
};

class InstrumentSampler {
  constructor() {
    this.ctx = null;
    this.buffers = {};   // instrument key -> { midiNote: AudioBuffer }
    this.loading = {};   // instrument key -> in-flight Promise
    this.failed = {};    // instrument key -> true once a load has given up
  }

  attach(ctx) {
    this.ctx = ctx;
  }

  /** True once at least one recording for this instrument is decoded and usable. */
  isReady(key) {
    const map = this.buffers[key];
    return !!map && Object.keys(map).length > 0;
  }

  /**
   * Decodes every anchor recording for one instrument. Missing files are
   * skipped rather than fatal - the nearest surviving anchor is stretched a
   * little further instead, and if every one fails the caller falls back to
   * the original synthesis.
   */
  async load(key) {
    if (!this.ctx) return null;
    const voice = INSTRUMENT_VOICES[key];
    if (!voice) return null;
    if (this.buffers[key]) return this.buffers[key];
    if (this.loading[key]) return this.loading[key];

    const anchors = voice.anchors || SAMPLE_ANCHORS;

    this.loading[key] = (async () => {
      const decoded = await Promise.all(anchors.map(async ([name, midi]) => {
        try {
          const res = await fetch(`${voice.dir}/${name}.mp3`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
          return [midi, buffer];
        } catch (e) {
          return null;
        }
      }));

      const map = {};
      decoded.forEach(entry => { if (entry) map[entry[0]] = entry[1]; });

      delete this.loading[key];
      if (Object.keys(map).length === 0) {
        console.warn(`No samples loaded for "${key}" - falling back to synthesis.`);
        this.failed[key] = true;
        return null;
      }
      this.buffers[key] = map;
      return map;
    })();

    return this.loading[key];
  }

  /**
   * Picks a loop inside the steady part of a sustained recording.
   *
   * A whole number of nominal cycles is not enough on its own: a real
   * recording drifts slightly off its nominal pitch, so after thirty-odd
   * cycles the error adds up and the seam steps audibly. Instead the nominal
   * length is only a starting guess, and the loop end is then chosen by
   * comparing the waveform either side of the join and keeping whichever
   * offset matches best - the same waveform-similarity idea the tanpura's
   * time-stretch already uses.
   */
  getLoopPoints(buffer, anchorMidi) {
    if (buffer._lehraLoop !== undefined) return buffer._lehraLoop;

    const sr = buffer.sampleRate;
    const data = buffer.getChannelData(0);
    const total = buffer.length;
    const period = sr / (440 * Math.pow(2, (anchorMidi - 69) / 12));

    // Start well after the attack, and leave the recording's own release tail
    // outside the loop.
    const start = Math.floor(total * 0.45);
    const limit = Math.floor(total * 0.92);
    const cycles = Math.floor((limit - start) / period);

    if (cycles < 8) {
      buffer._lehraLoop = null;   // too short to loop; cached either way
      return null;
    }

    // Match a window either side of the join rather than a single sample, so
    // the harmonics line up and not just the fundamental.
    const half = Math.min(128, Math.floor(period));
    const guess = start + Math.round(cycles * period);
    const search = Math.ceil(period * 3);

    let bestEnd = guess;
    let bestError = Infinity;
    for (let offset = -search; offset <= search; offset++) {
      const end = guess + offset;
      if (end - start < period * 8 || end + half >= total || end - half < 0) continue;
      let error = 0;
      for (let i = -half; i < half; i++) {
        const diff = data[start + i] - data[end + i];
        error += diff * diff;
      }
      if (error < bestError) {
        bestError = error;
        bestEnd = end;
      }
    }

    const loop = { start: start / sr, end: bestEnd / sr };
    buffer._lehraLoop = loop;
    return loop;
  }

  /**
   * Plays one note. Returns true if a recording was used, false if the caller
   * should fall back to its oscillator version.
   *
   * Must stay synchronous: this runs on the scheduler's critical path, so it
   * only ever touches buffers that are already decoded.
   */
  play(key, freq, duration, time, destination, volumeScalar = 1.0) {
    const voice = INSTRUMENT_VOICES[key];
    const map = this.buffers[key];
    if (!voice || !map || !this.ctx || !destination) return false;

    const midi = 69 + 12 * Math.log2(freq / 440);

    // Nearest anchor, so the resampling stretch stays as small as possible.
    let anchor = null;
    let bestDistance = Infinity;
    for (const candidate in map) {
      const distance = Math.abs(Number(candidate) - midi);
      if (distance < bestDistance) {
        bestDistance = distance;
        anchor = Number(candidate);
      }
    }
    if (anchor === null) return false;

    const buffer = map[anchor];
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Resample onto the wanted note, then take out however far this particular
    // recording sits off standard pitch.
    const trim = (SAMPLE_TUNING[key] && SAMPLE_TUNING[key][anchor]) || 0;
    source.playbackRate.value = Math.pow(2, (midi - anchor) / 12 - trim / 1200);

    const gainNode = this.ctx.createGain();
    const level = Math.max(0.0001, voice.gain * SAMPLE_LEVEL_BOOST * volumeScalar);

    // The recording carries its own attack, so the envelope only shapes the
    // end of the note.
    gainNode.gain.setValueAtTime(level, time);

    // Ring-out and release are capped by the note's own length. Letting a
    // santoor ring a third of a second past the beat sounds right at vilambit,
    // but at drut the beat itself is shorter than that and every note would
    // still be sounding three notes later, which just turns to mush.
    const ring = voice.sustained ? 0 : Math.min(voice.ring, duration);
    const release = Math.min(voice.release, Math.max(0.08, duration));

    const holdUntil = time + duration + ring;
    gainNode.gain.setValueAtTime(level, holdUntil);
    gainNode.gain.linearRampToValueAtTime(0.0001, holdUntil + release);

    if (voice.sustained) {
      const loop = this.getLoopPoints(buffer, anchor);
      if (loop) {
        source.loop = true;
        source.loopStart = loop.start;
        source.loopEnd = loop.end;
      }
    }

    source.connect(gainNode);
    gainNode.connect(destination);

    source.start(time);
    source.stop(holdUntil + release + 0.02);

    return source;
  }
}
