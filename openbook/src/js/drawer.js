// 3. Tiroir d'applis (style Pixel Launcher) : recherche en pilule,
// grille alphabétique (applis Google, puis applis Windows installées),
// clic droit pour épingler ou ajouter au bureau.
import { APPS, WIN_APPS, byId, normalize } from "./apps.js";
import { addShortcut } from "./desktop.js";
import { isPinned, pin, unpin } from "./dock.js";
import { appIcon, launch, openUrl } from "./launch.js";
import { invoke, listen } from "./tauri.js";
import { closeAllPanels, closePanel, isOpen, menuOpen, openPanel, showMenu, toast } from "./ui.js";
import { onWindowsApps } from "./winapps.js";

const $ = (s) => document.querySelector(s);
const drawer = $("#drawer");
const launcher = $("#launcher");
const input = $("#search-input");
const grid = $("#app-grid");

export function appMenu(app, x, y) {
  const pinned = isPinned(app.id);
  showMenu(x, y, [
    { label: "Ouvrir", icon: "open", run: () => launch(app) },
    pinned
      ? { label: "Désépingler du dock", icon: "unpin", run: () => unpin(app.id) }
      : { label: "Épingler au dock", icon: "pin", run: () => pin(app.id) },
    { label: "Ajouter au bureau", icon: "desktop", run: () => addShortcut(app.id) },
  ]);
}

function section(title, apps) {
  const wrap = document.createElement("section");
  wrap.className = "grid-section";
  const h = document.createElement("h3");
  h.className = "grid-title";
  h.textContent = title;
  const list = document.createElement("div");
  list.className = "grid-list";
  list.setAttribute("role", "list");
  for (const app of apps) {
    const b = document.createElement("button");
    b.className = "grid-app press";
    b.dataset.id = app.id;
    b.dataset.key = normalize(app.name);
    b.setAttribute("role", "listitem");
    b.title = app.name;
    b.append(appIcon(app, 60));
    const label = document.createElement("span");
    label.className = "grid-label";
    label.textContent = app.name;
    b.append(label);
    b.addEventListener("click", () => {
      closeDrawer();
      launch(app);
    });
    b.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      appMenu(app, e.clientX, e.clientY);
    });
    list.append(b);
  }
  wrap.append(h, list);
  return wrap;
}

function renderGrid() {
  grid.innerHTML = "";
  grid.append(section("Applis", APPS), section("Applis Windows", WIN_APPS));
  filter();
}

function filter() {
  const q = normalize(input.value);
  let shown = 0;
  for (const sec of grid.querySelectorAll(".grid-section")) {
    let inSection = 0;
    for (const b of sec.querySelectorAll(".grid-app")) {
      const match = !q || b.dataset.key.includes(q);
      b.hidden = !match;
      if (match) inSection++;
    }
    sec.hidden = inSection === 0;
    shown += inSection;
  }
  $("#grid-empty").hidden = shown > 0;
}

export function openDrawer() {
  openPanel(drawer, launcher);
  input.value = "";
  filter();
  grid.scrollTop = 0;
  setTimeout(() => input.focus({ preventScroll: true }), 60);
}

export function closeDrawer() {
  closePanel(drawer);
}

async function askGemini() {
  const q = input.value.trim();
  closeDrawer();
  if (q) {
    try {
      await invoke("copy_text", { text: q });
    } catch {
      await navigator.clipboard?.writeText(q).catch(() => {});
    }
    toast("Question copiée, colle-la avec Ctrl+V", { icon: "sparkle", force: true, ms: 5000 });
  }
  launch(byId.get("gemini"));
}

export function initDrawer() {
  renderGrid();
  onWindowsApps(renderGrid);
  launcher.addEventListener("click", () => (isOpen(drawer) ? closeDrawer() : openDrawer()));
  input.addEventListener("input", filter);
  $("#search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    closeDrawer();
    openUrl("https://www.google.com/search?q=" + encodeURIComponent(q), "la recherche");
  });
  $("#ask-gemini").addEventListener("click", askGemini);

  addEventListener("pointerdown", (e) => {
    if (!isOpen(drawer) || menuOpen()) return;
    if (!drawer.contains(e.target) && !launcher.contains(e.target) && !e.target.closest("#menu")) closeDrawer();
  });

  // Quick Insert : Verr. Maj (intercepté par le Rust) ouvre ou ferme la recherche.
  const quickInsert = () => {
    if (isOpen(drawer) && document.hasFocus()) return closeDrawer();
    closeAllPanels();
    openDrawer();
  };
  listen("quick-insert", quickInsert);
  // Démo navigateur : Verr. Maj n'est pas intercepté, on l'écoute ici.
  addEventListener("keydown", (e) => {
    if (e.key === "CapsLock" && !window.__TAURI__) quickInsert();
  });
}
