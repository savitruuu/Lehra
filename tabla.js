/**
 * Lehra - Tabla Theka
 *
 * Plays the theka of the active taal from recorded strokes, one bol per matra,
 * on the same clock as the lehra and the metronome so the three never drift.
 *
 * RECORDINGS
 *
 * Single strokes by msarkar (freesound.org pack "tabla bols"), licensed
 * CC Sampling Plus 1.0 - see the credit line in the Settings screen.
 *
 * The pack also contains finished Dha and Dhin recordings, and they are not
 * used. A dha is the bayan and the dayan struck together, and the app has to be
 * able to move the dayan onto whichever Sa the user has chosen - which a single
 * mixed recording cannot do, because retuning it would drag the bass drum along
 * with it and turn the bayan into a bongo. So the composite bols are built here
 * out of their two halves instead, which is how they are actually played, and
 * each drum is then pitched on its own.
 *
 * TUNING: the dayan on these recordings sounds Sa at 262.76 Hz - measured, from
 * the 2nd, 3rd and 4th partials of every stroke in the pack, which agree to
 * about a cent and a half. That is C4 plus 7.5 cents, so the drum was tuned to
 * roughly C and the figure is not the nominal 261.63.
 */
const TABLA_SOURCE_SA_HZ = 262.76;

/**
 * drum - decides how the stroke is retuned. Dayan strokes are pitched to Sa;
 *        the bayan is not a tuned drum and only follows part of the way (see
 *        getStrokeRates below).
 * gain - trim so the strokes sit at a comparable level. Measured, not guessed:
 *        each figure is the peak of a 40ms sliding RMS over the recording,
 *        referred to na. The pack arrives at very uneven levels - ke needed
 *        close to three times na's trim to be audible next to it at all.
 */
const TABLA_STROKES = {
  ge:  { file: "ge.mp3",  drum: "bayan", gain: 0.85 },
  ke:  { file: "ke.mp3",  drum: "bayan", gain: 2.90 },
  na:  { file: "na.mp3",  drum: "dayan", gain: 1.00 },
  ta:  { file: "ta.mp3",  drum: "dayan", gain: 1.45 },
  tin: { file: "tin.mp3", drum: "dayan", gain: 0.90 },
  tu:  { file: "tu.mp3",  drum: "dayan", gain: 1.60 },
  te:  { file: "te.mp3",  drum: "dayan", gain: 1.35 },
  re:  { file: "re.mp3",  drum: "dayan", gain: 1.35 }
};

/**
 * A bol as written in a theka, against the strokes it is actually played with.
 *
 * A bare stroke name lands on the matra, so two of them means both hands
 * together - which is what a dha is, the bayan and the dayan struck at once.
 * An entry may instead be written { stroke, at }, where `at` is a position
 * within the matra expressed in matras: that is for bols played as a sequence
 * inside their own beat rather than as one attack.
 *
 * Only Dha, Dhin, Tin, Ta and Na are needed for Teentaal and Jhaptaal; the rest
 * are here so a theka added later does not fall silent. Lookup ignores case and
 * spacing, so "Dhin", "dhin", "TiTe" and "Ti Te" all resolve.
 */
const TABLA_BOLS = {
  dha:  ["ge", "na"],
  dhin: ["ge", "tin"],
  dhun: ["ge", "tu"],
  dhi:  ["ge", "tin"],
  tin:  ["tin"],
  ta:   ["ta"],
  na:   ["na"],
  tun:  ["tu"],
  ge:   ["ge"],
  ghe:  ["ge"],
  ke:   ["ke"],
  ka:   ["ke"],
  kat:  ["ke"],
  te:   ["te"],
  ti:   ["te"],
  re:   ["re"],

  // Not used by either theka as they stand - kept as the worked example of the
  // { stroke, at } form, since a compound bol is the only reason that form
  // exists. Two closed dayan strokes on the two halves of one matra.
  //
  // Voiced te then re, not te twice: Ti and Te both map to the same recording
  // above, and firing it at itself half a matra later is heard as a sample
  // repeating rather than as two strokes.
  tite: [{ stroke: "te", at: 0 }, { stroke: "re", at: 0.5 }],

  "-":  []
};

/**
 * Scales whose Sa the dayan takes an octave below the lehra's.
 *
 * PITCH_MAP is written in octave 4 and the recordings sit at C, so tuning the
 * dayan straight onto the chosen Sa means stretching it upwards - by C it is a
 * unison, but by B it is eleven semitones, and a single sample pushed that far
 * stops sounding like a drum and starts sounding like a toy. Real tabla has the
 * same limit: a dayan only has so much range, so from the middle of the scale
 * upwards a player tunes it to the Sa an octave down rather than to an
 * impossible little drum.
 *
 * Splitting at F puts every scale within a fifth of the source recording:
 * C to E stretch up by 0 to 4 semitones, F to B drop by 7 down to 1.
 */
const TABLA_OCTAVE_DOWN_FROM = "F#";
const TABLA_CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Longest a stroke may ring, as a multiple of one matra - per drum, because the
 * two decay nothing like each other.
 *
 * Both were originally held to 1.75 matras, which is shorter than either drum
 * actually rings. An open ge runs 1.57s and a tin or a tu close to 2s, so at
 * anything above vilambit the cap was landing mid-decay on the strokes that are
 * supposed to sing - and a theka whose resonant strokes are all cut at the same
 * point sounds shut down on every beat.
 *
 * The bayan gets the longer allowance since it is the resonant drum. The dayan
 * stays a little tighter: it carries the articulation, and it is the drum that
 * turns muddy first if consecutive bols are left to overlap. The closed strokes
 * on either drum - ke, te, re - are only about 0.16s to begin with, so none of
 * this reaches them.
 */
const TABLA_RING_MATRAS = { bayan: 2.25, dayan: 2.0 };

/**
 * However fast the tempo, a drum always gets at least this long to speak. Only
 * binds at the very top of the range - by 400 BPM two matras is 0.3s - and it is
 * what stops drut from turning the theka into a row of clicks.
 */
const TABLA_MIN_RING = { bayan: 0.40, dayan: 0.30 };

/**
 * How the ring is closed off once it reaches that cap.
 *
 * These are the time constants of an exponential glide, not linear ramp lengths.
 * A straight line down is what a drum being switched off sounds like; the ear
 * hears the corner rather than the decay. The bayan gets the longer one so its
 * tail simply thins out into the next matra; the dayan's is shorter because its
 * ring is higher and thinner, and drawing it out that far would smear the
 * articulation the theka is being read for.
 *
 * Both are held to one matra at the point of use, or at drut the fade alone
 * would run longer than the beat and the tails would stack into a drone.
 */
const TABLA_RING_FADE = { bayan: 0.32, dayan: 0.16 };

/**
 * Tone shaping for the bayan, applied to the whole drum rather than per stroke.
 *
 * The shelf is the weight the user hears as "more bass". The high-pass under it
 * pays for that: below about 40Hz there is nothing on these recordings a phone
 * or a laptop can reproduce, but that energy still counts towards the peak and
 * so towards how hard the limiter downstream has to work. Taking it out first
 * means the shelf can lift the part that is actually audible without the bus
 * getting any louder in the process.
 */
const TABLA_BAYAN_HPF_HZ = 42;
const TABLA_BAYAN_SHELF_HZ = 115;
const TABLA_BAYAN_SHELF_DB = 3.5;

/**
 * Level of the bayan against the dayan, in dB.
 *
 * Sits at the end of the drum's own chain rather than on the stroke gains, so
 * it moves ge and ke together and leaves the measured balance between them - and
 * the ring lengths above - untouched. Slightly down: the shelf put weight into
 * the drum, and past a point extra weight reads as the bayan being louder than
 * the hands that play it rather than deeper.
 */
const TABLA_BAYAN_TRIM_DB = -1.5;

class TablaSampler {
  constructor() {
    this.ctx = null;
    this.buffers = {};      // stroke key -> AudioBuffer
    this.loading = null;    // in-flight load promise
    this.failed = false;
    this.pitch = "C#";
    this.pitchCents = 0;    // fine-tune offset, set alongside the pitch
    this._bayanIn = null;   // shared bayan tone chain, built on first stroke
    this._bayanDest = null;
  }

  attach(ctx) {
    this.ctx = ctx;
    // The bayan chain belongs to whichever context is current, so a new one
    // invalidates it.
    this._bayanIn = null;
    this._bayanDest = null;
  }

  /**
   * Input to the bayan's tone chain: high-pass, then low shelf, then trim, then
   * on to the tabla bus.
   *
   * Built once and shared by every bayan stroke rather than per stroke. Filters
   * are linear, so filtering the sum is identical to filtering each stroke, and
   * at drut this is the difference between two extra nodes and a couple of
   * hundred a minute. Rebuilt if the engine ever hands us a different bus.
   */
  _bayanInput(destination) {
    if (this._bayanIn && this._bayanDest === destination) return this._bayanIn;

    const hpf = this.ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = TABLA_BAYAN_HPF_HZ;
    hpf.Q.value = 0.707;

    const shelf = this.ctx.createBiquadFilter();
    shelf.type = "lowshelf";
    shelf.frequency.value = TABLA_BAYAN_SHELF_HZ;
    shelf.gain.value = TABLA_BAYAN_SHELF_DB;

    const trim = this.ctx.createGain();
    trim.gain.value = Math.pow(10, TABLA_BAYAN_TRIM_DB / 20);

    hpf.connect(shelf);
    shelf.connect(trim);
    trim.connect(destination);

    this._bayanIn = hpf;
    this._bayanDest = destination;
    return hpf;
  }

  /** True once every stroke is decoded. A partial set is not enough - a theka
   *  missing one of its bols is worse than no tabla at all. */
  isReady() {
    return Object.keys(this.buffers).length === Object.keys(TABLA_STROKES).length;
  }

  setPitch(pitch, cents = 0) {
    this.pitch = pitch;
    this.pitchCents = cents;
  }

  async load() {
    if (!this.ctx || this.failed) return null;
    if (this.isReady()) return this.buffers;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      const entries = await Promise.all(
        Object.entries(TABLA_STROKES).map(async ([key, stroke]) => {
          try {
            const res = await fetch(`audio/tabla/${stroke.file}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return [key, await this.ctx.decodeAudioData(await res.arrayBuffer())];
          } catch (e) {
            console.warn(`Tabla stroke "${key}" failed to load.`, e);
            return null;
          }
        })
      );

      this.loading = null;
      const map = {};
      entries.forEach(entry => { if (entry) map[entry[0]] = entry[1]; });

      if (Object.keys(map).length < Object.keys(TABLA_STROKES).length) {
        this.failed = true;
        console.warn("Tabla samples incomplete - the theka will stay silent.");
        return null;
      }

      this.buffers = map;
      return map;
    })();

    return this.loading;
  }

  /**
   * Playback rates for the two drums at the current scale.
   *
   * The dayan is tuned to Sa, dropping to the octave below from F upwards - see
   * TABLA_OCTAVE_DOWN_FROM. It is still the same Sa, just voiced on a drum that
   * can actually be tuned there.
   *
   * The bayan is not a tuned drum. A player retunes it a little when the scale
   * moves and mostly changes it with palm pressure while playing, so
   * transposing it in step with the dayan would be wrong - it would leave the
   * theka sounding like a pair of bongos at one end of the range and like a
   * floor tom at the other. Taking the square root moves it in the same
   * direction by about half as much in cents, which keeps it under the dayan
   * across the whole range without freezing it.
   */
  getStrokeRates() {
    // The fine-tune offset rides on the dayan with the scale. The octave split
    // below stays keyed to the named note, so bending a semitone either way
    // never flips the drum into the other octave mid-adjustment.
    const targetSa = (PITCH_MAP[this.pitch] || 277.18)
      * Math.pow(2, (this.pitchCents || 0) / 1200);

    const index = TABLA_CHROMATIC.indexOf(this.pitch);
    const split = TABLA_CHROMATIC.indexOf(TABLA_OCTAVE_DOWN_FROM);
    const octave = (index >= 0 && index >= split) ? 0.5 : 1;

    const dayan = (targetSa * octave) / TABLA_SOURCE_SA_HZ;
    return { dayan, bayan: Math.sqrt(dayan) };
  }

  /**
   * Sounds one bol. Returns the source nodes it started, so the engine can stop
   * them on the spot when the tabla is switched off mid-ring.
   *
   * Must stay synchronous - this runs on the scheduler's critical path and only
   * ever touches buffers that are already decoded.
   */
  playBol(bol, time, destination, beatDuration, accent = 1.0) {
    if (!this.ctx || !destination || !this.isReady()) return [];

    // Spacing is stripped as well as case, so a compound bol reads naturally in
    // the theka whether it is written "TiTe" or "Ti Te".
    const strokes = TABLA_BOLS[String(bol).toLowerCase().replace(/\s+/g, "")];
    if (!strokes || strokes.length === 0) return [];

    const rates = this.getStrokeRates();
    const played = [];

    strokes.forEach(entry => {
      // Bare name means "on the matra"; the object form carries an offset into
      // the matra for bols played as a sequence rather than as one attack.
      const key = typeof entry === "string" ? entry : entry.stroke;
      const at = typeof entry === "string" ? 0 : (entry.at || 0);
      const start = time + at * beatDuration;

      const buffer = this.buffers[key];
      const stroke = TABLA_STROKES[key];
      if (!buffer || !stroke) return;

      const isBayan = stroke.drum === "bayan";
      const rate = isBayan ? rates.bayan : rates.dayan;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;

      // Two hands never land on exactly the same millisecond, and neither do
      // two strokes of the same bol one cycle apart. A few percent of level
      // either way is enough to stop the theka reading as a loop of one
      // recording; the timing itself is left alone, since a practice reference
      // has to be dead steady.
      const humanise = 0.94 + Math.random() * 0.12;
      const level = Math.max(0.0001, stroke.gain * accent * humanise);

      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(level, start);

      // A dha rings for well over a second. At vilambit that is exactly right
      // and the recording is left to decay on its own; at drut the next bol has
      // come and gone twice over by then, so the ring is capped against the
      // matra and faded rather than left to pile up.
      const natural = buffer.duration / rate;
      const drum = stroke.drum;
      const allowed = Math.max(TABLA_MIN_RING[drum], beatDuration * TABLA_RING_MATRAS[drum]);
      const ring = Math.min(natural, allowed);

      // The fades are long in absolute terms, which is what makes them smooth
      // at the tempos this is actually practised at - but at drut a third of a
      // second is over two matras on its own. Held to one matra, the total is
      // around three matras of decay at any tempo rather than five at the top
      // end.
      const fade = Math.min(TABLA_RING_FADE[drum], beatDuration);

      if (ring < natural) {
        // setTargetAtTime, not a linear ramp: this is an exponential approach,
        // which is the shape a drum decays in anyway, so the cap stops reading
        // as a cut and starts reading as the drum simply dying away. The
        // recording is still decaying underneath it, and the two compound.
        //
        // The target is never quite reached, so the constant is a third of the
        // fade - about -26 dB by the time the source is stopped, which is under
        // the sample's own noise floor by then.
        gainNode.gain.setValueAtTime(level, start + ring);
        gainNode.gain.setTargetAtTime(0.0001, start + ring, fade / 3);
      }

      source.connect(gainNode);
      gainNode.connect(isBayan ? this._bayanInput(destination) : destination);

      source.start(start);
      source.stop(start + ring + fade + 0.02);

      played.push(source);
    });

    return played;
  }
}
