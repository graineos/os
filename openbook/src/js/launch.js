// Lancement des applis et rendu de leurs icônes.
import { faviconUrl } from "./apps.js";
import { svg } from "./icons.js";
import { invoke } from "./tauri.js";
import { notify, toast } from "./ui.js";

/** Applis ouvertes pendant cette session (point sous l'icône du dock). */
export const recent = new Set();
const recentListeners = new Set();
export const onRecentChange = (fn) => recentListeners.add(fn);

export async function launch(app) {
  try {
    if (app.special === "files") {
      await invoke("open_files");
    } else {
      const how = await invoke("open_app", { url: app.url });
      if (how === "browser") {
        notify("Chrome et Edge introuvables", `${app.name} s'ouvre dans ton navigateur par défaut.`, "open");
      }
    }
    recent.add(app.id);
    recentListeners.forEach((fn) => fn());
  } catch (err) {
    toast(`Impossible d'ouvrir ${app.name} : ${err?.message ?? err}`, { icon: "info", force: true });
  }
}

export async function openUrl(url, label) {
  try {
    await invoke("open_app", { url });
  } catch (err) {
    toast(`Impossible d'ouvrir ${label} : ${err?.message ?? err}`, { force: true });
  }
}

/**
 * Pastille ronde colorée avec le favicon du service.
 * Hors ligne, ou si Google renvoie une icône générique, on affiche la
 * première lettre à la place.
 */
export function appIcon(app, size = 56) {
  const chip = document.createElement("span");
  chip.className = "app-chip";
  chip.style.setProperty("--app", app.color);
  chip.style.setProperty("--size", size + "px");
  const letter = () => {
    chip.classList.add("letter");
    chip.textContent = app.name[0];
  };
  if (app.special === "files") {
    chip.classList.add("glyph");
    chip.innerHTML = svg("folder");
    return chip;
  }
  if (!navigator.onLine) {
    letter();
    return chip;
  }
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  img.draggable = false;
  img.referrerPolicy = "no-referrer";
  img.onload = () => {
    // Le service renvoie 16-32 px (globe ou « G ») quand il n'a pas d'icône dédiée.
    if (img.naturalWidth < 40) letter();
  };
  img.onerror = letter;
  img.src = faviconUrl(app);
  chip.append(img);
  return chip;
}
