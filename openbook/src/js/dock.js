// 2. Barre des tâches façon Android (bureau) : lanceur « O », Vue d'ensemble,
// applis épinglées avec leurs fenêtres ouvertes, puis les autres applis
// ouvertes. Survol : aperçus en direct. Clic droit : ancrer, fermer, épingler.
import { APPS, WIN_APPS, byId, normalize } from "./apps.js";
import { svg } from "./icons.js";
import { appIcon, launch, onRecentChange } from "./launch.js";
import { prefs, save } from "./store.js";
import { clearThumbs, showThumbs } from "./thumbs.js";
import { showMenu } from "./ui.js";
import { onWindowsApps } from "./winapps.js";
import { closeWindow, exeName, focusWindow, onWindows, openWindows, snapWindow, windowActions } from "./windows.js";

const list = document.querySelector("#dock-apps");
const others = document.querySelector("#dock-running");
const sep = document.querySelector("#dock-sep");
const preview = document.querySelector("#preview");

export function isPinned(id) {
  return prefs.pinned.includes(id);
}

export function pin(id) {
  if (isPinned(id)) return;
  prefs.pinned.push(id);
  save();
  renderDock();
}

export function unpin(id) {
  prefs.pinned = prefs.pinned.filter((p) => p !== id);
  save();
  renderDock();
}

/* ---------- Association fenêtres ↔ applis ---------- */

const BROWSERS = ["chrome", "msedge"];
const clean = (s) => normalize(s).replace(/[^a-z0-9]/g, "");

function belongs(app, w) {
  const exe = exeName(w.exe).toLowerCase();
  const title = normalize(w.title);
  const name = normalize(app.name);
  if (app.special === "files") return exe === "explorer";
  if (app.special) return false;
  if (app.kind === "win") {
    const n = clean(app.name);
    const b = clean(exe);
    return (b.length >= 3 && (b === n || n.startsWith(b) || b.startsWith(n))) || title.endsWith(name);
  }
  // Appli web ouverte en mode application (Chrome ou Edge --app).
  return BROWSERS.includes(exe) && (title.endsWith(name) || title.startsWith(name + " ") || title.includes(" " + name + " "));
}

/** Répartit les fenêtres : { pinned: Map<id, fenêtres>, others: [{ key, name, exe, windows }] }. */
function group(windows) {
  const pinned = new Map(prefs.pinned.map((id) => [id, []]));
  const free = new Set(windows);
  // Noms les plus longs d'abord : « YouTube Music » avant « YouTube ».
  const apps = prefs.pinned.map((id) => byId.get(id)).filter(Boolean).sort((a, b) => b.name.length - a.name.length);
  for (const app of apps) {
    for (const w of [...free]) {
      if (belongs(app, w)) {
        pinned.get(app.id).push(w);
        free.delete(w);
      }
    }
  }
  const rest = new Map();
  for (const w of free) {
    const key = w.exe.toLowerCase() || "w" + w.id;
    if (!rest.has(key)) rest.set(key, { key, exe: w.exe, name: exeName(w.exe) || w.title, windows: [] });
    rest.get(key).windows.push(w);
  }
  return { pinned, others: [...rest.values()] };
}

/** L'appli (épinglée d'abord, puis tout le catalogue) à laquelle appartient une fenêtre. */
export function appOfWindow(w) {
  const pinnedApps = prefs.pinned.map((id) => byId.get(id)).filter(Boolean);
  const all = [...pinnedApps, ...APPS, ...WIN_APPS].sort((a, b) => b.name.length - a.name.length);
  return all.find((a) => belongs(a, w));
}

/** L'appli installée (tiroir) correspondant à une fenêtre, pour son nom et son icône. */
function appForGroup(g) {
  return [...WIN_APPS, ...APPS].find((a) => a.kind === "win" && g.windows.some((w) => belongs(a, w)));
}

/* ---------- Aperçus au survol ---------- */

let hoverTimer = 0;
let hideTimer = 0;
let previewFor = null;

function hidePreview() {
  clearTimeout(hoverTimer);
  previewFor = null;
  preview.hidden = true;
  preview.innerHTML = "";
  clearThumbs("preview");
}

function openPreview(button, windows) {
  if (!windows.length) return;
  previewFor = button;
  preview.innerHTML = "";
  const cards = [];
  for (const w of windows) {
    const card = document.createElement("div");
    card.className = "pv-card";
    card.innerHTML = `<div class="pv-head"><span class="pv-title"></span><button class="icon-btn pv-close" title="Fermer">${svg("close")}</button></div><div class="pv-thumb"></div>`;
    card.querySelector(".pv-title").textContent = w.title;
    card.querySelector(".pv-thumb").dataset.label = w.title;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".pv-close")) return;
      hidePreview();
      focusWindow(w);
    });
    card.querySelector(".pv-close").addEventListener("click", () => {
      hidePreview();
      closeWindow(w);
    });
    preview.append(card);
    cards.push({ id: w.id, el: card.querySelector(".pv-thumb") });
  }
  preview.hidden = false;
  const r = button.getBoundingClientRect();
  const pr = preview.getBoundingClientRect();
  preview.style.left = Math.max(8, Math.min(innerWidth - pr.width - 8, r.left + r.width / 2 - pr.width / 2)) + "px";
  requestAnimationFrame(() => showThumbs("preview", cards));
}

function hoverable(button, getWindows) {
  button.addEventListener("pointerenter", () => {
    clearTimeout(hideTimer);
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => openPreview(button, getWindows()), previewFor ? 0 : 450);
  });
  button.addEventListener("pointerleave", () => {
    clearTimeout(hoverTimer);
    hideTimer = setTimeout(hidePreview, 250);
  });
}

preview.addEventListener("pointerenter", () => clearTimeout(hideTimer));
preview.addEventListener("pointerleave", () => (hideTimer = setTimeout(hidePreview, 250)));

/* ---------- Rendu ---------- */

function activate(app, windows, button) {
  hidePreview();
  if (!windows.length) return app && launch(app);
  if (windows.length > 1) return openPreview(button, windows);
  const w = windows[0];
  if (w.active && !w.minimized) snapWindow(w, "min");
  else focusWindow(w);
}

function menuFor(app, windows) {
  const items = [];
  if (app) items.push({ label: windows.length ? "Nouvelle fenêtre" : "Ouvrir", icon: "open", run: () => launch(app) });
  if (windows.length) {
    const w = windows.find((x) => x.active) ?? windows[0];
    items.push(...windowActions(w));
    if (windows.length > 1) items.push({ label: "Fermer toutes les fenêtres", icon: "close", run: () => windows.forEach(closeWindow) });
  }
  if (app) {
    items.push(
      isPinned(app.id)
        ? { label: "Désépingler", icon: "unpin", run: () => unpin(app.id) }
        : { label: "Épingler", icon: "pin", run: () => pin(app.id) },
    );
  }
  return items;
}

function item({ app, name, exe, windows, size = 48 }) {
  const b = document.createElement("button");
  b.className = "dock-app press";
  b.classList.toggle("running", windows.length > 0);
  b.classList.toggle("active", windows.some((w) => w.active && !w.minimized));
  b.classList.toggle("many", windows.length > 1);
  const label = app?.name ?? name;
  b.title = windows.length > 1 ? `${label} — ${windows.length} fenêtres` : label;
  b.setAttribute("aria-label", b.title);
  b.append(app ? appIcon(app, size) : appIcon({ id: "exe:" + exe, name, exe, color: "#5f6368" }, size));
  const bar = document.createElement("span");
  bar.className = "dock-bar";
  b.append(bar);
  b.addEventListener("click", () => activate(app, windows, b));
  b.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    hidePreview();
    showMenu(e.clientX, e.clientY - 8, menuFor(app, windows));
  });
  hoverable(b, () => windows);
  return b;
}

export function renderDock() {
  const { pinned, others: rest } = group(openWindows);
  list.innerHTML = "";
  for (const id of prefs.pinned) {
    const app = byId.get(id);
    if (app) list.append(item({ app, windows: pinned.get(id) ?? [] }));
  }
  others.innerHTML = "";
  for (const g of rest.slice(0, 10)) {
    const app = appForGroup(g);
    others.append(item({ app, name: g.name, exe: g.exe, windows: g.windows }));
  }
  others.hidden = sep.hidden = rest.length === 0;
  if (previewFor && !document.contains(previewFor)) hidePreview();
}

onRecentChange(renderDock);
onWindowsApps(renderDock);
onWindows(renderDock);
addEventListener("blur", hidePreview);
addEventListener("pointerdown", (e) => {
  if (!preview.hidden && !preview.contains(e.target) && !e.target.closest(".dock-app")) hidePreview();
});

export { hidePreview };
