/**
 * Saved defaults - theme, palette, and the four player defaults.
 *
 * ON-DEVICE ONLY, the same rule as practiceLog.js: this is the browser's
 * localStorage and nothing else. Signing in does not move these to a server,
 * and the API has no route that would take them.
 */
const SETTINGS_STORAGE_KEY = "lehra_user_settings";

/**
 * Every non-default palette, and the body class it lives behind (see
 * style.css). "default" needs no class - it is what is left once the others are
 * removed.
 */
export const PALETTE_CLASSES = {
  moss: "palette-moss",
  midnight: "palette-midnight",
  deepocean: "palette-deepocean"
};

export const PALETTE_OPTIONS = [
  { value: "default", label: "Forest & Cream (Default)" },
  { value: "moss", label: "Moss & Sage" },
  { value: "midnight", label: "Midnight Steel" },
  { value: "deepocean", label: "Deep Ocean" }
];

export const DEFAULT_SETTINGS = {
  theme: "dark",
  palette: "default",
  taal: "teentaal",
  raag: "hemant",
  instrument: "santoor",
  pitch: "C#",
  bpm: 120
};

export function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!stored) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch (e) {
    console.error("Error reading saved defaults:", e);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Paints the theme and palette onto <body>.
 *
 * Still class-toggling on the body element rather than React state feeding a
 * className: style.css is written against `body.dark-mode` and
 * `body.palette-*`, several hundred rules deep, and rewriting all of it to hang
 * off a wrapper div would be a restyle rather than a port.
 */
export function applyTheme({ theme, palette }) {
  document.body.classList.toggle("dark-mode", theme === "dark");

  Object.values(PALETTE_CLASSES).forEach((cls) =>
    document.body.classList.remove(cls)
  );
  const cls = PALETTE_CLASSES[palette];
  if (cls) document.body.classList.add(cls);
}
