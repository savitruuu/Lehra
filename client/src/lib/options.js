import { TAAL_DATA, RAAG_LIBRARY } from "../engine/taalData.js";

/**
 * The option lists the pickers offer.
 *
 * Taal and raag are derived from the engine's own data rather than restated
 * here - a taal added to TAAL_DATA shows up in the picker without a second
 * edit, which is what the hand-written <option> lists in the pre-build
 * index.html could not do (there were three copies of the raag list to keep in
 * step, and they had already drifted).
 */

/** Every taal, in the order TAAL_DATA declares them. */
export const TAAL_OPTIONS = Object.entries(TAAL_DATA).map(([value, taal]) => ({
  value,
  label: `${taal.name} (${taal.matras} Matras)`,
  // Theka-only taals have no lehra written for their cycle length, so the
  // lehra player must not offer them - only tabla accompaniment mode does.
  thekaOnly: !!taal.thekaOnly
}));

/** The taals the lehra player can actually play. */
export const LEHRA_TAAL_OPTIONS = TAAL_OPTIONS.filter((t) => !t.thekaOnly);

/**
 * The raags that have a lehra written for a given cycle length.
 *
 * Switching taal re-runs this: a raag with no line for the new matra count is
 * genuinely unplayable there, and the first available one takes over - the same
 * rule the pre-build updateRaagOptionsForTaal applied.
 */
export function raagOptionsForTaal(taalKey) {
  const matras = TAAL_DATA[taalKey]?.matras ?? 16;
  return Object.entries(RAAG_LIBRARY)
    .filter(([, raag]) => raag.lehra && raag.lehra[matras])
    .map(([value, raag]) => ({ value, label: raag.name }));
}

/**
 * Every raag, regardless of which cycle lengths it has a line for.
 *
 * Only the Settings screen uses this: a saved default is a preference, not a
 * selection, and it stays valid for whichever taal it does fit. The player's
 * own picker uses raagOptionsForTaal above.
 */
export const ALL_RAAG_OPTIONS = Object.entries(RAAG_LIBRARY).map(
  ([value, raag]) => ({ value, label: raag.name })
);

export const INSTRUMENT_OPTIONS = [
  { value: "harmonium", label: "Harmonium" },
  { value: "sitar", label: "Sitar" },
  { value: "piano", label: "Piano" },
  { value: "santoor", label: "Santoor" },
  { value: "guitar", label: "Guitar" }
];

/**
 * The twelve scales, labelled the way a harmonium player names them - Safed
 * (white) and Kali (black) with their number.
 */
export const PITCH_OPTIONS = [
  { value: "C", label: "C (Safed 1)" },
  { value: "C#", label: "C# (Kali 1)" },
  { value: "D", label: "D (Safed 2)" },
  { value: "D#", label: "D# (Kali 2)" },
  { value: "E", label: "E (Safed 3)" },
  { value: "F", label: "F (Safed 4)" },
  { value: "F#", label: "F# (Kali 3)" },
  { value: "G", label: "G (Safed 5)" },
  { value: "G#", label: "G# (Kali 4)" },
  { value: "A", label: "A (Safed 6)" },
  { value: "A#", label: "A# (Kali 5)" },
  { value: "B", label: "B (Safed 7)" }
];

/** The same twelve without the harmonium naming, for the Settings default. */
export const PITCH_PLAIN_OPTIONS = PITCH_OPTIONS.map(({ value }) => ({
  value,
  label: value
}));

/**
 * The dial's range, low to high. Not the chromatic order starting at C - it is
 * arranged so the dial simply clamps at each end instead of wrapping: G is the
 * lowest Sa the up/down buttons will reach, F# the highest.
 */
export const SCALE_STEP_ORDER = [
  "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#"
];

/**
 * The three laya presets. They are a readout as well as a control: whichever
 * matches the current tempo is the laya being practised, however the tempo got
 * there. Anything between two presets leaves all three unlit rather than
 * rounding to the nearest, since 137 BPM is not Madhya laya in any useful
 * sense.
 */
export const LAYA_PRESETS = [
  { id: "vilambit", label: "Vilambit", bpm: 60 },
  { id: "madhya", label: "Madhya", bpm: 120 },
  { id: "drut", label: "Dhrut", bpm: 240 }
];

/**
 * The tanpura's first string. Pancham (Sa-Pa) is the standard tuning; Madhyam
 * (Sa-Ma) is what a singer wants for raags that drop Pa or lean on Ma -
 * Malkauns, Bageshri, Lalit. Nishad (Sa-Ni) is for Marwa, Puriya, Sohani and
 * Poorvi.
 */
export const TANPURA_STRINGS = [
  { type: "pa", label: "Pancham" },
  { type: "ma", label: "Madhyam" },
  { type: "ni", label: "Nishad" }
];
