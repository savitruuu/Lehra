/**
 * Popular raags for the swarmandal.
 *
 * A swarmandal is a small plucked zither with 21-36 strings tuned to the notes
 * of the raag being sung. The singer brushes a finger across it at points of
 * rest - upward for the aaroh (ascent), downward for the avaroh (descent) - and
 * the strings sound in pitch order as a silvery cascade. It does not play vakra
 * (crooked) phrases; a brush is just the scale, in order, one way or the other.
 * (See darbar.org/swarmandal and chandrakantha.com's surmandal page.)
 *
 * So each raag here is exactly that: the ascending run and the descending run as
 * ordered semitone offsets from Sa. 0 = madhya Sa, 12 = taar Sa; a value below 0
 * is a mandra note. The aaroh climbs about an octave (a mandra lead-in up to
 * taar Sa); the avaroh is longer, cascading from taar Sa down through madhya Sa
 * into the mandra octave, and it is played a little quicker than the aaroh.
 * Many raags drop or add notes in one direction only - Khamaj takes no Re going
 * up but a komal Ni coming down - which is why the two are listed separately
 * rather than one reversed.
 *
 * `pakad` and `pakad2` are two catch-phrases: the short note-combinations that
 * name the raag to the ear. Both are played quietly between the aaroh and the
 * avaroh brushes so the flourish says which raag it is, not just which scale. A
 * swarmandal can only pluck strings in order, so these are the phrases' note
 * skeletons - no meend or andolan, just the plain notes in the order the phrase
 * moves through them. Sources: notesandsargam.com, tanarang.com, sharda.org.
 *
 * Kept apart from RAAG_LIBRARY in taalData.js: those entries carry lehra lines
 * and human-readable aroha strings, not machine scale arrays, and only a few of
 * them are raags a singer would tune a swarmandal to.
 */
export const SWARMANDAL_RAAGS = [
  {
    key: "yaman",
    name: "Yaman",
    aaroh: [-1, 2, 4, 6, 7, 9, 11, 12],
    avaroh: [12, 11, 9, 7, 6, 4, 2, 0, -1, -3, -5],   // Ś..S..Ṗ
    pakad: [-1, 2, 4, 6, 4, 2, 0],           // Ṇ R G M G R S
    pakad2: [7, 6, 4, 2, -1, 0]              // P M G R Ṇ S
  },
  {
    key: "bhairav",
    name: "Bhairav",
    aaroh: [0, 1, 4, 5, 7, 8, 11, 12],
    avaroh: [12, 11, 8, 7, 5, 4, 1, 0, -1, -4, -5],
    pakad: [5, 8, 7, 4, 1, 0],               // m d P G r S
    pakad2: [-1, 0, 1, 0, 4, 5, 7]           // Ṇ S r S G m P
  },
  {
    key: "bhairavi",
    name: "Bhairavi",
    aaroh: [0, 1, 3, 5, 7, 8, 10, 12],
    avaroh: [12, 10, 8, 7, 5, 3, 1, 0, -2, -4, -5],
    pakad: [0, 3, 5, 7, 8, 7],              // S g m P d P
    pakad2: [5, 3, 1, 0, -2, 0]             // m g r S ṇ S
  },
  {
    key: "bhoopali",
    name: "Bhoopali",
    aaroh: [0, 2, 4, 7, 9, 12],
    avaroh: [12, 9, 7, 4, 2, 0, -3, -5],
    pakad: [4, 2, 0, -3, 0, 2, 4],           // G R S Ḍ S R G
    pakad2: [4, 7, 9, 7, 4, 2, 0]            // G P D P G R S
  },
  {
    key: "kafi",
    name: "Kafi",
    aaroh: [0, 2, 3, 5, 7, 9, 10, 12],
    avaroh: [12, 10, 9, 7, 5, 3, 2, 0, -2, -3, -5],
    pakad: [0, 2, 3, 5, 3, 2, 0],           // S R g m g R S
    pakad2: [7, 9, 10, 9, 7, 5, 3]          // P D n D P m g
  },
  {
    key: "khamaj",
    name: "Khamaj",
    aaroh: [0, 4, 5, 7, 9, 11, 12],
    avaroh: [12, 10, 9, 7, 5, 4, 2, 0, -2, -3, -5],
    pakad: [7, 10, 9, 7, 5, 4, 2, 0],        // P n D P m G R S
    pakad2: [4, 5, 7, 9, 11, 12]             // G m P D N Ś
  },
  {
    key: "des",
    name: "Des",
    aaroh: [0, 2, 5, 7, 11, 12],
    avaroh: [12, 10, 9, 7, 5, 4, 2, 0, -2, -3, -5],
    pakad: [2, 5, 7, 11, 10, 9, 7],          // R m P N n D P
    pakad2: [0, 2, 5, 7, 9, 5, 4, 2]         // S R m P D m G R
  },
  {
    key: "malkauns",
    name: "Malkauns",
    aaroh: [0, 3, 5, 8, 10, 12],
    avaroh: [12, 10, 8, 5, 3, 0, -2, -4, -7],
    pakad: [5, 3, 5, 3, 0, -2, 0],           // m g m g S ṇ S
    pakad2: [5, 8, 10, 8, 5, 3]              // m d n d m g
  },
  {
    key: "bhimpalasi",
    name: "Bhimpalasi",
    aaroh: [0, 3, 5, 7, 10, 12],
    avaroh: [12, 10, 9, 7, 5, 3, 2, 0, -2, -3, -5],
    pakad: [-2, 0, 5, 3, 2, 0],              // ṇ S m g R S
    pakad2: [5, 7, 10, 12, 10, 9, 7]         // m P n Ś n D P
  },
  {
    key: "darbari",
    name: "Darbari Kanada",
    aaroh: [0, 2, 3, 5, 7, 8, 10, 12],
    avaroh: [12, 10, 8, 7, 5, 3, 2, 0, -2, -4, -5],
    pakad: [9, 10, 7, 5, 3, 5, 2, 0],        // D n P m g m R S
    pakad2: [2, 3, 2, 0, -2, -5]             // R g R S ṇ Ṗ
  }
];

/** {value, label} pairs for the anchored raag picker in the Tabla layout. */
export const SWARMANDAL_RAAG_OPTIONS = SWARMANDAL_RAAGS.map((r) => ({
  value: r.key,
  label: r.name
}));

/** The one selected by default - a bright, universally familiar evening raag. */
export const DEFAULT_SWARMANDAL_RAAG = "yaman";

export function swarmandalRaagByKey(key) {
  return (
    SWARMANDAL_RAAGS.find((r) => r.key === key) ||
    SWARMANDAL_RAAGS.find((r) => r.key === DEFAULT_SWARMANDAL_RAAG)
  );
}
