// OpenBook — point d'entrée.
import { renderDock } from "./dock.js";
import { initDrawer } from "./drawer.js";
import { hydrateIcons } from "./icons.js";
import { prefs, save } from "./store.js";
import { applyTheme } from "./theme.js";
import { applyWindowMode, initTopbar } from "./topbar.js";
import { closeAllPanels, hideMenu, menuOpen, notify, renderNotifications } from "./ui.js";
import { hasTauri } from "./tauri.js";

applyTheme();
hydrateIcons();
initTopbar();
renderDock();
initDrawer();
renderNotifications();

if (!prefs.welcomed) {
  prefs.welcomed = true;
  save();
  notify("Bienvenue sur OpenBook", "Clique sur « O » pour voir toutes tes applis.", "sparkle");
}

if (hasTauri) applyWindowMode();

addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (document.querySelector("#confirm").open) return;
  if (menuOpen()) hideMenu();
  else closeAllPanels();
});

// Pas de menu contextuel du navigateur (Inspecter, Recharger…) dans le launcher.
addEventListener("contextmenu", (e) => {
  if (!e.target.closest("input, textarea")) e.preventDefault();
});

// Ctrl+R / F5 rechargeraient l'interface : inutile dans un launcher.
addEventListener("keydown", (e) => {
  if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) e.preventDefault();
});
