// Couleurs dynamiques Material 3 (schéma Tonal Spot) à partir d'une couleur
// source, appliquées en variables CSS. Mode clair / sombre.
// La couleur source vient du fond d'écran choisi (voir WALLPAPERS).
import { argbFromHex, hexFromArgb, Hct, SchemeTonalSpot, MaterialDynamicColors as C } from "../vendor/mcu.js";
import { prefs, save } from "./store.js";

const ROLES = [
  "primary", "onPrimary", "primaryContainer", "onPrimaryContainer",
  "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer",
  "tertiary", "onTertiary", "tertiaryContainer", "onTertiaryContainer",
  "error", "onError", "errorContainer", "onErrorContainer",
  "surface", "surfaceDim", "surfaceBright", "onSurface", "onSurfaceVariant",
  "surfaceContainerLowest", "surfaceContainerLow", "surfaceContainer",
  "surfaceContainerHigh", "surfaceContainerHighest",
  "inverseSurface", "inverseOnSurface", "inversePrimary",
  "outline", "outlineVariant", "scrim", "shadow",
];

/** Fonds d'écran Material 3 : une couleur source + un motif. */
export const WALLPAPERS = [
  { id: "aurore", name: "Aurore", seed: "#3b5ba9", pattern: "aurora" },
  { id: "corail", name: "Corail", seed: "#b04a5a", pattern: "blobs" },
  { id: "foret", name: "Forêt", seed: "#3f7d4e", pattern: "waves" },
  { id: "dune", name: "Dune", seed: "#9a6b2f", pattern: "dunes" },
  { id: "lavande", name: "Lavande", seed: "#6f5bd6", pattern: "waves" },
  { id: "lagon", name: "Lagon", seed: "#1f7a8c", pattern: "blobs" },
  { id: "rose", name: "Pivoine", seed: "#a8457e", pattern: "aurora" },
  { id: "ardoise", name: "Ardoise", seed: "#51607a", pattern: "dunes" },
];

export function currentWallpaper() {
  return WALLPAPERS.find((w) => w.id === prefs.wallpaper) ?? WALLPAPERS[0];
}

const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set();

export function isDark() {
  return prefs.dark ?? systemDark.matches;
}

export function schemeFor(seed, dark) {
  return new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), dark, 0);
}

/** Couleurs du schéma courant, par rôle (camelCase → #rrggbb). */
export function colors(seed = currentWallpaper().seed, dark = isDark()) {
  const scheme = schemeFor(seed, dark);
  return Object.fromEntries(ROLES.map((r) => [r, hexFromArgb(C[r].getArgb(scheme))]));
}

/** Palette d'accent Windows (8 teintes, du plus clair au plus foncé). */
export function accentPalette(seed = currentWallpaper().seed) {
  const pal = schemeFor(seed, isDark()).primaryPalette;
  return [90, 80, 70, 50, 40, 30, 20, 60].map((t) => hexFromArgb(pal.tone(t)));
}

export function onThemeChange(fn) {
  listeners.add(fn);
}

export function applyTheme() {
  const dark = isDark();
  const c = colors(currentWallpaper().seed, dark);
  const root = document.documentElement.style;
  for (const [role, hex] of Object.entries(c)) root.setProperty("--" + kebab(role), hex);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", dark ? "dark" : "light");
  listeners.forEach((fn) => fn(c, dark));
}

export function setDark(value) {
  prefs.dark = value;
  save();
  applyTheme();
}

export function setWallpaper(id) {
  prefs.wallpaper = id;
  save();
  applyTheme();
}

systemDark.addEventListener("change", () => {
  if (prefs.dark === null) applyTheme();
});

// Les autres fenêtres d'OpenBook (bulle Gemini) suivent les changements.
addEventListener("storage", (e) => {
  if (e.key && e.key.startsWith("openbook.prefs")) {
    Object.assign(prefs, JSON.parse(e.newValue ?? "{}"));
    applyTheme();
  }
});
