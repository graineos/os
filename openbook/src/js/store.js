// Préférences d'OpenBook, enregistrées dans localStorage.

const KEY = "openbook.prefs.v1";

const DEFAULTS = {
  dark: null, // null = suivre Windows
  dnd: false,
  fullscreen: true,
  seed: "#3b5ba9",
  pinned: ["gmail", "drive", "docs", "youtube", "gemini", "files"],
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
