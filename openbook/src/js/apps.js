// Catalogue des applis. Trois sortes :
// - web : `url` s'ouvre en mode application (Chrome ou Edge avec --app) ;
//   `icon` remplace l'adresse utilisée pour trouver le favicon ;
// - special : commande native (Fichiers → explorateur, Paramètres Windows…) ;
// - win : appli Windows installée (raccourci du menu Démarrer), ajoutée au
//   démarrage par winapps.js.

const WEB = [
  { id: "gmail", name: "Gmail", url: "https://mail.google.com/mail/", color: "#ea4335" },
  { id: "drive", name: "Drive", url: "https://drive.google.com/", color: "#1e8e3e" },
  { id: "docs", name: "Docs", url: "https://docs.google.com/document/", color: "#4285f4" },
  { id: "sheets", name: "Sheets", url: "https://docs.google.com/spreadsheets/", color: "#0f9d58" },
  { id: "slides", name: "Slides", url: "https://docs.google.com/presentation/", color: "#f4b400" },
  { id: "calendar", name: "Agenda", url: "https://calendar.google.com/", color: "#4285f4" },
  { id: "meet", name: "Meet", url: "https://meet.google.com/", color: "#00897b" },
  { id: "youtube", name: "YouTube", url: "https://www.youtube.com/", color: "#ff0000" },
  { id: "ytmusic", name: "YouTube Music", url: "https://music.youtube.com/", color: "#ff0000" },
  { id: "maps", name: "Maps", url: "https://www.google.com/maps/", icon: "https://maps.google.com/", color: "#34a853" },
  { id: "photos", name: "Photos", url: "https://photos.google.com/", color: "#fbbc04" },
  { id: "keep", name: "Keep", url: "https://keep.google.com/", color: "#f9ab00" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com/app", color: "#6f5bd6" },
  { id: "translate", name: "Traduction", url: "https://translate.google.com/", color: "#4285f4" },
  { id: "news", name: "Actualités", url: "https://news.google.com/", color: "#1a73e8" },
  { id: "contacts", name: "Contacts", url: "https://contacts.google.com/", color: "#1a73e8" },
  { id: "opendoor", name: "OpenDoor", url: "https://angel-beta.fr/opendoor", color: "#5b6cf0" },
  { id: "files", name: "Fichiers", special: "files", glyph: "folder", color: "#8a6d00" },
];

const SYSTEM = [
  { id: "winsettings", name: "Paramètres Windows", special: "settings", page: "home", glyph: "settings", color: "#5f6368" },
  { id: "store", name: "Microsoft Store", special: "settings", page: "store", glyph: "bag", color: "#0067b8" },
];

const collator = new Intl.Collator("fr", { sensitivity: "base" });
const byName = (a, b) => collator.compare(a.name, b.name);

/** Applis Google et OpenBook, par ordre alphabétique. */
export const APPS = [...WEB].sort(byName);

/** Applis Windows (menu Démarrer + Paramètres + Store). */
export const WIN_APPS = [...SYSTEM].sort(byName);

export const byId = new Map([...APPS, ...WIN_APPS].map((a) => [a.id, a]));

const PALETTE = ["#4285f4", "#db4437", "#0f9d58", "#f4b400", "#ab47bc", "#00acc1", "#ff7043", "#5c6bc0", "#7cb342", "#8d6e63"];

function colorFor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Ajoute les applis installées trouvées dans le menu Démarrer. */
export function registerWindowsApps(list) {
  const known = new Set(WIN_APPS.map((a) => a.name.toLowerCase()));
  for (const { name, path } of list) {
    if (known.has(name.toLowerCase())) continue;
    known.add(name.toLowerCase());
    const app = { id: "win:" + path.toLowerCase(), name, path, kind: "win", color: colorFor(name) };
    WIN_APPS.push(app);
    byId.set(app.id, app);
  }
  WIN_APPS.sort(byName);
}

export function faviconUrl(app) {
  return app.url
    ? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(app.icon ?? app.url)}&sz=128`
    : null;
}

export function normalize(s) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
