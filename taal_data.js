/**
 * Lehra - Taal & Raag Data Module
 *
 * SEMITONE OFFSET KEY (relative to Sa = 0, middle octave)
 *
 *  Lower octave notes (Mandra Saptak):
 *  -12 = Sa  (lower octave)
 *   -5 = Pa  (lower)
 *   -3 = Ga  Shuddha (lower)
 *   -2 = Re  Shuddha (lower) / Ni Komal (lower)
 *   -1 = Ni  Shuddha (lower)  <- one semitone below Sa
 *
 *  Middle octave (Madhya Saptak):
 *   0  = Sa
 *   1  = Re  Komal  (r)
 *   2  = Re  Shuddha (R)
 *   3  = Ga  Komal  (g)
 *   4  = Ga  Shuddha (G)
 *   5  = Ma  Shuddha (M)
 *   6  = Ma  Teevra  (m) (Tivra)
 *   7  = Pa
 *   8  = Dha Komal  (d)
 *   9  = Dha Shuddha (D)
 *  10  = Ni  Komal  (n)
 *  11  = Ni  Shuddha (N)
 *
 *  Upper octave (Taar Saptak):
 *  12  = Sa' (upper Sa)
 *  14  = Re' Shuddha (upper)
 *  16  = Ga' Shuddha (upper)
 *
 *  null is a tie, not a rest. A whole matra of null holds the previous matra's
 *  swara through it; a null *inside* a sub-beat array holds the swara before it
 *  through that slot. So [5, null, 4, 5] is Ma for half the matra, then Ga and
 *  Ma for a quarter each - which is how a notation grid writes म↦गम.
 */

const RAAG_LIBRARY = {
  kirwani: {
    name: "Kirwani",
    thaat: "Kirwani",
    time: "Night",
    vadi: 2, samvadi: 7,
    aroha_display:   "Sa Sa Sa Sa Gak Pa Pa Pa",
    avaroha_display: "Gak Pa d n | d M | G g | G P | G Sa | d(low) n(low) n(low)",
    lehra: {
      16: [0, 0, 0, [0, 3], 7, 7, 7, [3, 7, 8, 10], 8, 5, [3, 2], [3, 7], 3, 0, -4, [-1, -1]]
    }
  },
  kirwani2: {
    name: "Kirwani 2",
    thaat: "Kirwani",
    time: "Night",
    vadi: 2, samvadi: 7,
    aroha_display:   "Śa Śa Śa Śa Ṙe Nik Dhak Pa",
    avaroha_display: "Pa Dhak Nik Dhak | Dhak Ma | Re Ma | Gak Sa | Gak Pa Dhak Ni",
    lehra: {
      16: [12, 12, 12, [12, 14], 10, 8, 7, [7, 8, 10, 8], 8, 5, [2, 5], [3, 0], 3, 7, 8, 11]
    }
  },
  des: {
    name: "Des",
    thaat: "Khamaj",
    time: "Night",
    vadi: 2, samvadi: 7,
    aroha_display:   "Śa Śa Śa Śa Ṙe Nik Dha Pa",
    avaroha_display: "Dha Pa | Ma Ga | Re Re | Ma Pa Ni",
    lehra: {
      16: [12, null, null, [12, 14], 10, 9, 7, 9, 7, 5, 4, 2, 2, 5, 7, 11]
    }
  },
  mylehra: {
    name: "Charukeshi 2",
    thaat: "Bhairavi",
    time: "Anytime",
    vadi: 0, samvadi: 7,
    aroha_display:   "Sa Sa Re Ga Ma Pa Ma Ga",
    avaroha_display: "Re Ga Sa | Pa Ma Pa Ga | Re Ga Sa | d(low) n(low) Pa",
    lehra: {
      16: [0, 0, [2, 4], [5, 7], 5, 4, [2, 4], 0, 7, [5, 7], 4, [2, 4], 0, -4, -2, -5]
    }
  },
  mylehra2: {
    name: "Mishra",
    thaat: "Kafi",
    time: "Anytime",
    vadi: 0, samvadi: 7,
    aroha_display:   "Śa Śa Śa Śa Ṙe N D M",
    avaroha_display: "D Śa N P | G g G Sa | G P N P | D P",
    lehra: {
      16: [12, 12, 12, [12, 14], 11, 9, 5, [9, 12], 11, 7, [4, 3], [4, 0], 4, 7, [11, 7], [9, 7]]
    }
  },
  shuddha_saarang: {
    name: "Shuddha Saarang",
    thaat: "Kalyan",
    time: "Afternoon",
    vadi: 2, samvadi: 7,
    aroha_display:   "Śa Śa Śa Pa Ni Śa Ṙe | Ni Dha Pa",
    avaroha_display: "Re Ma' Pa Dha | Pa Ma' Pa Ma' Re | Ni. Sa Re Ma' Pa Ni",
    lehra: {
      16: [12, 12, 12, [7, 11, 12, 14], 11, 9, 7, [2, 6, 7, 9], 7, [6, 7], [5, 2], [-1, 0], 2, 6, 7, 11]
    }
  },
  bhimpalasi: {
    name: "Bhimpalasi",
    thaat: "Kafi",
    time: "Afternoon",
    vadi: 5, samvadi: 0,
    aroha_display:   "Śa Śa Śa Nik Śa Nik Dha Pa",
    avaroha_display: "Ma Pa Gak Gak Re Sa Gak Ma Pa Nik Pa",
    lehra: {
      16: [12, 12, 12, [10, 12], 10, 9, 7, [5, 7], 3, 3, 2, 0, 3, 5, 7, [10, 7]]
    }
  },
  janasammohini: {
    name: "Janasammohini",
    thaat: "Khamaj",
    time: "Evening",
    vadi: 7, samvadi: 0,
    aroha_display:   "Śa Śa Śa [Śa Ṙe] Nik Dha Pa [Ga Pa Dha Nik]",
    avaroha_display: "Dha Pa Ga [Re Nik.] Sa Ga Pa [Dha Nik]",
    lehra: {
      16: [12, 12, 12, [12, 14], 10, 9, 7, [4, 7, 9, 10], 9, 7, 4, [2, -2], 0, 4, 7, [9, 10]]
    }
  },
  charukeshi: {
    name: "Charukeshi",
    thaat: "Natabhairavi",
    time: "Evening",
    vadi: 7, samvadi: 4,
    aroha_display:   "Śa Śa Śa [Dhak Nik Śa Ġa] Ṙe [Nik Śa]",
    avaroha_display: "[Dhak Ma] [Ga Ma Dhak Śa] Nik [Dhak Ma] [Ga Ma] [Re Nik.] Sa Ga Ma [Dhak Nik]",
    lehra: {
      16: [12, 12, 12, [8, 10, 12, 16], 14, [10, 12], [8, 5], [4, 5, 8, 12], 10, [8, 5], [4, 5], [2, -2], 0, 4, 5, [8, 10]]
    }
  },
  jog: {
    name: "Jog",
    thaat: "Kafi",
    time: "Late Night",
    vadi: 7, samvadi: 0,
    aroha_display:   "Pa Pa Pa [Ga Ma Pa Śa] Nik Pa Ma [Ga Ma Pa Śa]",
    avaroha_display: "Nik Pa [Ma~ Ga Ma] [Gak~ Nik. Sa] | [Nik.~~ Pa.] [Sa~~ Nik.] Ga [Ma~ Gak Sa]",
    lehra: {
      // Matras 11-16 transcribed from the notation grid: the avaroha runs on
      // quarter-matra subdivisions with held swaras, and cadences म ग॒ सा into
      // Sam rather than climbing ग म into it.
      16: [7, 7, 7, [4, 5, 7, 12], 10, 7, 5, [4, 5, 7, 12], 10, 7,
           [5, null, 4, 5], [3, null, -2, 0], [-2, null, null, -5],
           [0, null, null, -2], 4, [5, null, 3, 0]]
    }
  },
  darbari: {
    name: "Darbari Kanada",
    thaat: "Asavari",
    time: "Late Night",
    vadi: 2, samvadi: 7,
    aroha_display:   "Śa Śa Śa [Dhak Nik] Ṙe [Ṙe Śa] [Ṙe Ṗa] [Ṁa Ṗa]",
    avaroha_display: "Ġak [Ġak Ṁa] Ṙe Śa | [Nik Śa] [Ṙe Śa] Nik [Ma Pa]",
    lehra: {
      // Sam is taar Sa. Matra 4's Dha-komal Ni-komal dip is the Darbari
      // signature; matras 7-10 lift into the taar saptak and walk back down,
      // and the cycle closes on a madhya Ma Pa rising into Sam.
      16: [12, 12, 12, [8, 10], 14, [14, 12], [14, 19], [17, 19],
           15, [15, 17], 14, 12, [10, 12], [14, 12], 10, [5, 7]]
    }
  },
  chandrakauns: {
    name: "Chandrakauns",
    thaat: "Bhairavi",
    time: "Late Night",
    vadi: 5, samvadi: 0,
    aroha_display:   "Śa Śa Śa [Ni Śa] Ni Dhak Ni Śa",
    avaroha_display: "Ni Dhak Ma [Gak Sa] | Gak Ma Dhak [Ni Dhak]",
    lehra: {
      // Malkauns' scale with a SHUDDHA Ni, which is what makes it Chandrakauns -
      // note 11 rather than 10. Ga and Dha stay komal, and Re and Pa are absent.
      16: [12, 12, 12, [11, 12], 11, 8, 11, 12,
           11, 8, 5, [3, 0], 3, 5, 8, [11, 8]]
    }
  },
  hansadhwani: {
    name: "Hansadhwani",
    thaat: "Bilawal",
    time: "Evening",
    vadi: 0, samvadi: 7,
    aroha_display:   "Śa Śa Śa [Ni Śa] Ni Pa [Ga Pa] [Re Sa]",
    avaroha_display: "Ni. Ni. Sa Sa | Re Ga [Pa Ni] [Śa Ni]",
    lehra: {
      // Audava both ways - no Ma and no Dha anywhere. Matras 9-10 drop to mandra
      // Ni for the Sa-Ni.-Sa turn, then matras 11-16 walk the aroha back to Sam.
      16: [12, 12, 12, [11, 12], 11, 7, [4, 7], [2, 0],
           -1, -1, 0, 0, 2, 4, [7, 11], [12, 11]],
      10: [4, 4, [4, 7], [2, 4], 0, -1, -5, [-1, 0], [4, 2], [0, 2]]
    }
  },
  tilak_kamod: {
    name: "Tilak Kamod",
    thaat: "Khamaj",
    time: "Evening",
    vadi: 7, samvadi: 2,
    aroha_display:   "Śa Re Ga Pa Dha Pa Ni Śa",
    avaroha_display: "Śa Ni Pa Ma Ga Re Sa",
    lehra: {
      // Beat 10 splits into two half-matras: Pa then Ni.
      // Beat 7 is middle octave Sa.
      10: [12, 7, 9, 5, 7, 4, 0, 2, 5, [7, 11]]
    }
  },
  pilu: {
    name: "Pilu",
    thaat: "Kafi",
    time: "Anytime",
    vadi: 4, samvadi: 0,
    aroha_display:   "Sa Gak Ma Pa Dha Ni Śa",
    avaroha_display: "Śa Ni Dha Pa Ma Gak Re Sa",
    lehra: {
      10: [4, 0, 4, 5, 7, 3, 0, 2, -1, 0]
    }
  },
  hemant: {
    name: "Hemant",
    thaat: "Bilawal",
    time: "Late Night",
    vadi: 5, samvadi: 0,
    aroha_display:   "Śa Śa Śa [Ni Śa] Dha Ma Dha [Ni Śa]",
    avaroha_display: "Dha Ma [Ga Ma] [Re Sa] Ga Ma Dha Ni",
    lehra: {
      16: [12, 12, 12, [11, 12], 9, 5, 9, [11, 12], 9, 5, [4, 5], [2, 0], 4, 5, 9, 11]
    }
  }
};

// ------------------------------------------------------------
//  TAAL DEFINITIONS
// ------------------------------------------------------------
const TAAL_DATA = {
  teentaal: {
    name: "Teentaal",
    matras: 16,
    vibhaags: [4, 4, 4, 4],
    tali_positions:  [1, 5, 13],
    khali_positions: [9],
    theka: ["Dha","Dhin","Dhin","Dha","Dha","Dhin","Dhin","Dha","Dha","Tin","Tin","Ta","Ta","Dhin","Dhin","Dha"],
    get lehra() { return buildTaalLehra(this.matras); }
  },
  jhaptaal: {
    name: "Jhaptaal",
    matras: 10,
    vibhaags: [2, 3, 2, 3],
    tali_positions:  [1, 3, 8],
    khali_positions: [6],
    theka: ["Dhin","Na","Dhin","Dhin","Na","Tin","Na","Dhin","Dhin","Na"],
    get lehra() { return buildTaalLehra(this.matras); }
  }
};

/**
 * Bols as they are written, in Devanagari.
 *
 * The theka arrays above stay in Latin because they are what the code matches
 * on - TABLA_BOLS in tabla.js keys off them, and a stroke lookup should not
 * depend on a script. This is the display layer for them.
 *
 * Anything unmapped falls through unchanged rather than disappearing, so a
 * theka added later still reads, just in Latin until it is given a spelling.
 */
const BOL_DEVANAGARI = {
  Dha:  "धा",
  Dhin: "धिं",
  Dhi:  "धि",
  Dhun: "धुं",
  Na:   "ना",
  Tin:  "तिं",
  Ta:   "ता",
  Tun:  "तूं",
  Ge:   "घे",
  Ghe:  "घे",
  Ke:   "के",
  Ka:   "क",
  Kat:  "कत",
  Te:   "ते",
  Ti:   "टि",
  Re:   "रे",
  TiTe: "टिते"
};

function bolToDevanagari(bol) {
  if (!bol) return "";
  return BOL_DEVANAGARI[bol] || bol;
}

/**
 * Returns the lehra note array for the active raag + taal combination.
 * Falls back gracefully to 16-matra if a specific length isn't defined.
 */
function buildTaalLehra(matras) {
  const raagKey = window._activeRaagKey || "kirwani";
  const raag    = RAAG_LIBRARY[raagKey] || RAAG_LIBRARY.kirwani;
  const seq     = (raag.lehra && (raag.lehra[matras] || raag.lehra[16])) || RAAG_LIBRARY.kirwani.lehra[16];
  
  const baseObj = {
    harmonium: seq,
    flute:     seq,
    bansuri:   seq,
    violin:    seq,
    sitar:     seq,
    santoor:   seq,
    piano:     seq,
    guitar:    seq,
  };

  return new Proxy(baseObj, {
    get(target, prop) {
      if (typeof prop === "string" && prop in target) {
        return target[prop];
      }
      return seq;
    }
  });
}

// ------------------------------------------------------------
//  PITCH MAP - Sa base frequencies (Hz)
// ------------------------------------------------------------
const PITCH_MAP = {
  "C":  261.63, "C#": 277.18, "D":  293.66, "D#": 311.13,
  "E":  329.63, "F":  349.23, "F#": 369.99, "G":  392.00,
  "G#": 415.30, "A":  440.00, "A#": 466.16, "B":  493.88
};

const PITCH_PRESETS = {
  male:   ["C", "C#", "D", "D#"],
  female: ["G", "G#", "A", "A#"]
};

// Active raag key - controlled by the UI raag selector
window._activeRaagKey = "kirwani";