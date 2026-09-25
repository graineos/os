// Paramètres OpenBook : fond d'écran, thème, Mode Googlebook (réglages
// Windows réversibles), Quick Insert, Magic Pointer, Glowbar. Écran d'accueil
// au premier lancement pour tout activer en un clic.
import { svg } from "./icons.js";
import { prefs, save } from "./store.js";
import { accentPalette, isDark, setDark, setWallpaper, WALLPAPERS } from "./theme.js";
import { hasTauri, invoke } from "./tauri.js";
import { closeAllPanels, notify, toast } from "./ui.js";
import { exportPng, thumbnail } from "./wallpaper.js";

const $ = (s) => document.querySelector(s);
const dlg = $("#settings");
const welcome = $("#welcome");

/* ---------- Mode Googlebook ---------- */

const GB_OPTIONS = [
  ["theme", "Thème clair ou sombre de Windows", "Menus, Paramètres, Explorateur : même thème qu'OpenBook, avec la transparence.", "dark"],
  ["accent", "Couleur d'accent Material You", "Boutons, menus et barre des tâches prennent la couleur d'OpenBook.", "palette"],
  ["wallpaper", "Même fond d'écran partout", "Le fond d'OpenBook devient celui de Windows : aucune rupture en passant de l'un à l'autre.", "wallpaper"],
  ["autohide", "Masquer la barre des tâches Windows", "Seul le dock d'OpenBook reste visible. La barre Windows réapparaît si tu pointes en bas de l'écran.", "windows"],
];

function gbOptions() {
  const g = prefs.googlebook;
  return {
    theme: g.theme,
    dark: isDark(),
    accent: g.accent,
    palette: accentPalette(),
    wallpaper: g.wallpaper ? exportPng() : null,
    autohide: g.autohide,
  };
}

export async function applyGooglebook({ silent = false } = {}) {
  if (!hasTauri) return;
  try {
    await invoke("googlebook_apply", { options: gbOptions() });
    prefs.googlebook.applied = true;
    save();
    if (!silent) notify("Windows est en mode Googlebook", "Tu peux revenir à Windows à tout moment dans les paramètres.", "sparkle");
  } catch (err) {
    toast(`Mode Googlebook : ${err?.message ?? err}`, { force: true });
  }
  renderGooglebook();
}

async function restoreWindows() {
  try {
    await invoke("googlebook_restore");
    prefs.googlebook.applied = false;
    save();
    notify("Windows est revenu comme avant", "Thème, couleur, fond d'écran et barre des tâches d'origine.", "undo");
  } catch (err) {
    toast(`Restauration : ${err?.message ?? err}`, { force: true });
  }
  renderGooglebook();
}

let syncTimer = 0;
/** Après un changement de thème ou de fond : Windows suit, s'il est en mode Googlebook. */
export function syncWindows() {
  if (!prefs.googlebook.applied || !hasTauri) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => applyGooglebook({ silent: true }), 1200);
}

function renderGooglebook() {
  const list = $("#gb-options");
  list.innerHTML = "";
  for (const [key, title, desc, icon] of GB_OPTIONS) {
    const row = document.createElement("label");
    row.className = "set-row";
    row.innerHTML = `<span class="set-icon">${svg(icon)}</span>
      <span class="set-text"><strong>${title}</strong><span>${desc}</span></span>
      <input type="checkbox" class="switch" ${prefs.googlebook[key] ? "checked" : ""}>`;
    row.querySelector("input").addEventListener("change", (e) => {
      prefs.googlebook[key] = e.target.checked;
      save();
      syncWindows();
    });
    list.append(row);
  }
  const on = prefs.googlebook.applied;
  $("#gb-status").textContent = !hasTauri
    ? "Disponible dans l'application Windows."
    : on
      ? "Activé : Windows suit OpenBook."
      : "Désactivé : Windows garde ses réglages.";
  $("#gb-status").classList.toggle("on", on);
  $("#gb-apply").textContent = on ? "Réappliquer" : "Transformer Windows";
  $("#gb-restore").hidden = !on;
}

/* ---------- Fonctions ---------- */

const FEATURES = [
  ["quickInsert", "Quick Insert (Verr. Maj)", "Verr. Maj ouvre la recherche d'OpenBook, partout. Maj + Verr. Maj active les majuscules.", "keyboard"],
  ["magicPointer", "Magic Pointer", "Secoue la souris n'importe où pour demander à Gemini.", "pointer"],
  ["glowbar", "Glowbar", "Barre lumineuse en haut de l'écran : démarrage, Gemini, recharge.", "glow"],
];

export function pushFeatures() {
  if (hasTauri) invoke("set_features", { features: prefs.features }).catch(() => {});
}

function renderFeatures() {
  const list = $("#feature-options");
  list.innerHTML = "";
  for (const [key, title, desc, icon] of FEATURES) {
    const row = document.createElement("label");
    row.className = "set-row";
    row.innerHTML = `<span class="set-icon">${svg(icon)}</span>
      <span class="set-text"><strong>${title}</strong><span>${desc}</span></span>
      <input type="checkbox" class="switch" ${prefs.features[key] ? "checked" : ""}>`;
    row.querySelector("input").addEventListener("change", (e) => {
      prefs.features[key] = e.target.checked;
      save();
      pushFeatures();
    });
    list.append(row);
  }
}

/* ---------- Fond d'écran et thème ---------- */

function renderWallpapers() {
  const grid = $("#wp-grid");
  grid.innerHTML = "";
  for (const wp of WALLPAPERS) {
    const b = document.createElement("button");
    b.className = "wp-item press";
    b.setAttribute("aria-pressed", String(wp.id === prefs.wallpaper));
    b.title = wp.name;
    b.append(thumbnail(wp));
    const name = document.createElement("span");
    name.textContent = wp.name;
    b.append(name);
    b.addEventListener("click", () => {
      setWallpaper(wp.id);
      renderWallpapers();
      syncWindows();
    });
    grid.append(b);
  }
  const mode = prefs.dark === null ? "auto" : prefs.dark ? "dark" : "light";
  for (const b of document.querySelectorAll("#theme-mode button")) {
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  }
}

/* ---------- Ouverture ---------- */

export function openSettings(section) {
  closeAllPanels();
  renderWallpapers();
  renderGooglebook();
  renderFeatures();
  if (!dlg.open) dlg.showModal();
  const body = $(".settings-body");
  body.focus({ preventScroll: true });
  if (section) $(`#set-${section}`)?.scrollIntoView({ block: "start" });
  else body.scrollTop = 0;
}

function showWelcome() {
  welcome.showModal();
}

export function initSettings() {
  $("#settings-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());
  $("#gb-apply").addEventListener("click", () => applyGooglebook());
  $("#gb-restore").addEventListener("click", restoreWindows);
  for (const b of document.querySelectorAll("#theme-mode button")) {
    b.addEventListener("click", () => {
      setDark(b.dataset.mode === "auto" ? null : b.dataset.mode === "dark");
      renderWallpapers();
      syncWindows();
    });
  }
  $("#welcome-go").addEventListener("click", async () => {
    welcome.close();
    prefs.welcomed = true;
    save();
    await applyGooglebook();
  });
  $("#welcome-later").addEventListener("click", () => {
    welcome.close();
    prefs.welcomed = true;
    save();
    notify("Bienvenue sur OpenBook", "Paramètres OpenBook → « Transformer Windows » quand tu veux.", "sparkle");
  });

  pushFeatures();
  if (!prefs.welcomed) setTimeout(showWelcome, 900);
}
