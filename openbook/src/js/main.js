// OpenBook — point d'entrée.
import { initDesktop } from "./desktop.js";
import { renderDock } from "./dock.js";
import { initDrawer } from "./drawer.js";
import { hydrateIcons } from "./icons.js";
import { initRunning } from "./running.js";
import { initSettings, openSettings } from "./settings.js";
import { applyTheme } from "./theme.js";
import { applyWindowMode, initTopbar } from "./topbar.js";
import { hasTauri } from "./tauri.js";
import { closeAllPanels, hideMenu, menuOpen, renderNotifications } from "./ui.js";
import { initWallpaper } from "./wallpaper.js";
import { loadWindowsApps } from "./winapps.js";

applyTheme();
hydrateIcons();
initWallpaper();
initTopbar();
renderDock();
initDrawer();
initDesktop({ onOpenSettings: openSettings });
initRunning();
initSettings();
renderNotifications();
loadWindowsApps();

if (hasTauri) applyWindowMode();

addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (document.querySelector("dialog[open]")) return; // la boîte de dialogue gère Échap
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
