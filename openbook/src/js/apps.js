// Catalogue des applis du tiroir. `url` s'ouvre en mode application
// (Chrome ou Edge avec --app) ; `special` déclenche une commande native ;
// `icon` remplace l'adresse utilisée pour trouver le favicon.

export const APPS = [
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
  { id: "files", name: "Fichiers", special: "files", color: "#8a6d00" },
].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));

export const byId = new Map(APPS.map((a) => [a.id, a]));

export function faviconUrl(app) {
  return app.url
    ? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(app.icon ?? app.url)}&sz=128`
    : null;
}

export function normalize(s) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
