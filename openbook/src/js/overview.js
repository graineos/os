// Vue d'ensemble (façon ChromeOS / Android) : toutes les fenêtres ouvertes en
// miniatures en direct. Clic pour y aller, boutons pour ancrer ou fermer.
// Win+Tab (intercepté par le Rust) ou le bouton du dock l'ouvrent.
import { svg } from "./icons.js";
import { appIcon } from "./launch.js";
import { listen } from "./tauri.js";
import { clearThumbs, showThumbs } from "./thumbs.js";
import { closeAllPanels } from "./ui.js";
import { appOfWindow } from "./dock.js";
import { closeWindow, exeName, focusWindow, onWindows, openWindows, refreshWindows, snapWindow } from "./windows.js";

const root = document.querySelector("#overview");
const grid = root.querySelector(".ov-grid");
const empty = root.querySelector(".ov-empty");
const button = document.querySelector("#overview-btn");
let open = false;

function layout(n) {
  const pad = 48;
  const gap = 28;
  const W = innerWidth - pad * 2;
  const H = innerHeight - 180;
  let best = { cols: 1, w: 0 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows - 52) * 1.6, 520);
    if (w > best.w) best = { cols, w };
  }
  return best;
}

function render() {
  const windows = openWindows;
  grid.innerHTML = "";
  empty.hidden = windows.length > 0;
  const { cols, w } = layout(windows.length);
  grid.style.gridTemplateColumns = `repeat(${cols}, ${Math.floor(w)}px)`;
  const thumbs = [];
  for (const win of windows) {
    const card = document.createElement("article");
    card.className = "ov-card";
    card.classList.toggle("active", win.active);
    const name = exeName(win.exe) || win.title;
    card.innerHTML = `
      <header class="ov-head">
        <span class="ov-icon"></span>
        <span class="ov-title"></span>
        <button class="icon-btn" data-snap="left" title="Ancrer à gauche">${svg("snapLeft")}</button>
        <button class="icon-btn" data-snap="max" title="Agrandir">${svg("expand")}</button>
        <button class="icon-btn" data-snap="right" title="Ancrer à droite">${svg("snapRight")}</button>
        <button class="icon-btn" data-close title="Fermer">${svg("close")}</button>
      </header>
      <div class="ov-thumb" style="height:${Math.floor(w / 1.6)}px"></div>`;
    const app = appOfWindow(win);
    card.querySelector(".ov-icon").append(app ? appIcon(app, 28) : appIcon({ id: "exe:" + win.exe, name, exe: win.exe, color: "#5f6368" }, 28));
    card.querySelector(".ov-title").textContent = win.title;
    card.querySelector(".ov-thumb").dataset.label = win.title;
    card.addEventListener("click", (e) => {
      const snap = e.target.closest("[data-snap]");
      if (e.target.closest("[data-close]")) return closeWindow(win);
      hide();
      if (snap) snapWindow(win, snap.dataset.snap);
      else focusWindow(win);
    });
    grid.append(card);
    thumbs.push({ id: win.id, el: card.querySelector(".ov-thumb") });
  }
  requestAnimationFrame(() => requestAnimationFrame(() => open && showThumbs("overview", thumbs)));
}

let showing = false;

export function show() {
  showing = true;
  closeAllPanels();
  showing = false;
  open = true;
  root.hidden = false;
  root.getBoundingClientRect();
  root.classList.add("open");
  button?.setAttribute("aria-pressed", "true");
  refreshWindows();
  render();
}

export function hide() {
  if (!open) return;
  open = false;
  clearThumbs("overview");
  root.classList.remove("open");
  button?.setAttribute("aria-pressed", "false");
  setTimeout(() => !open && (root.hidden = true), 250);
}

export const isOverviewOpen = () => open;

export function initOverview() {
  button?.addEventListener("click", () => (open ? hide() : show()));
  root.addEventListener("click", (e) => {
    if (e.target === root || e.target === grid) hide();
  });
  addEventListener("keydown", (e) => open && e.key === "Escape" && hide());
  addEventListener("resize", () => open && render());
  onWindows(() => open && render());
  listen("overview", () => (open ? hide() : show()));
  addEventListener("openbook:close-all", () => !showing && hide());
}
