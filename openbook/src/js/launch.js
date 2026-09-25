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
    } else if (app.special === "settings") {
      await invoke("open_settings", { page: app.page });
    } else if (app.kind === "win") {
      await invoke("launch_windows_app", { path: app.path });
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

/* ---------- Icônes natives (raccourcis, exécutables) ---------- */

const nativeIcons = new Map(); // chemin → URL data: (ou null si aucune)
const pending = new Map(); // chemin → [callbacks]
let timer = 0;

/** Demande l'icône d'un fichier Windows ; les demandes sont groupées. */
export function nativeIcon(path, cb) {
  if (nativeIcons.has(path)) return cb(nativeIcons.get(path));
  if (!pending.has(path)) pending.set(path, []);
  pending.get(path).push(cb);
  clearTimeout(timer);
  timer = setTimeout(flushIcons, 30);
}

async function flushIcons() {
  const batch = new Map(pending);
  pending.clear();
  let result = {};
  try {
    result = (await invoke("app_icons", { paths: [...batch.keys()] })) ?? {};
  } catch {
    /* pas d'icône : la lettre reste */
  }
  for (const [path, cbs] of batch) {
    const url = result[path] ?? null;
    nativeIcons.set(path, url);
    cbs.forEach((cb) => cb(url));
  }
}

/**
 * Pastille ronde colorée avec l'icône de l'appli.
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
    chip.textContent = app.name.trim()[0]?.toUpperCase() ?? "?";
  };
  if (app.glyph) {
    chip.classList.add("glyph");
    chip.innerHTML = svg(app.glyph);
    return chip;
  }
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  img.draggable = false;
  if (app.kind === "win" || app.exe) {
    letter();
    nativeIcon(app.path ?? app.exe, (url) => {
      if (!url) return;
      chip.classList.remove("letter");
      chip.classList.add("native");
      chip.textContent = "";
      img.src = url;
      chip.append(img);
    });
    return chip;
  }
  if (!navigator.onLine) {
    letter();
    return chip;
  }
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
