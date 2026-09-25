// Couleurs dynamiques Material 3 (schéma Tonal Spot) à partir d'une couleur
// source, appliquées en variables CSS. Mode clair / sombre.
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

const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const systemDark = matchMedia("(prefers-color-scheme: dark)");

export function isDark() {
  return prefs.dark ?? systemDark.matches;
}

export function applyTheme() {
  const dark = isDark();
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(prefs.seed)), dark, 0);
  const root = document.documentElement.style;
  for (const role of ROLES) {
    root.setProperty("--" + kebab(role), hexFromArgb(C[role].getArgb(scheme)));
  }
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", dark ? "dark" : "light");
}

export function setDark(value) {
  prefs.dark = value;
  save();
  applyTheme();
}

systemDark.addEventListener("change", () => {
  if (prefs.dark === null) applyTheme();
});
