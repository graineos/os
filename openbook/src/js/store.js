// Préférences d'OpenBook, enregistrées dans localStorage.

const KEY = "openbook.prefs.v1";

const DEFAULTS = {
  dark: null, // null = suivre Windows
  dnd: false,
  fullscreen: true,
  wallpaper: "aurore",
  pinned: ["gmail", "drive", "docs", "youtube", "gemini", "files"],
  desktop: [], // raccourcis : { id, x, y }
  widgets: null, // null = widgets par défaut au premier lancement
  weather: null, // { lat, lon, name }
  features: { quickInsert: true, magicPointer: true, glowbar: true },
  googlebook: { applied: false, theme: true, accent: true, wallpaper: true, autohide: true },
  notifications: [],
  welcomed: false,
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* stockage indisponible : les réglages durent le temps de la session */
  }
}
