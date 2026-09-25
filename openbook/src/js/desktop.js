// 4. Bureau : raccourcis d'applis et widgets déplaçables, positions mémorisées.
// Clic droit ou appui long sur le bureau : ajouter un widget, fond d'écran…
import { byId } from "./apps.js";
import { svg } from "./icons.js";
import { appIcon, launch } from "./launch.js";
import { prefs, save } from "./store.js";
import { closeAllPanels, showMenu, toast } from "./ui.js";
import { WIDGETS } from "./widgets.js";
import { onWindowsApps } from "./winapps.js";

const desk = document.querySelector("#desktop");
const picker = document.querySelector("#widget-picker");
const cleanups = new Map(); // uid → fonction d'arrêt du widget
let openSettings = () => {};

const TOP = 48; // sous la barre du haut
const BOTTOM = 96; // au-dessus du dock

function clamp(x, y, w, h) {
  return [
    Math.round(Math.min(Math.max(8, x), innerWidth - w - 8)),
    Math.round(Math.min(Math.max(TOP, y), innerHeight - h - BOTTOM)),
  ];
}

/* ---------- Glisser-déposer ---------- */

/**
 * Rend `el` déplaçable. `onClick` est appelé si le pointeur n'a pas bougé.
 * Retourne la position finale via `onDrop(x, y)`.
 */
function draggable(el, { onDrop, onClick }) {
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("[data-nodrag], input, textarea, button:not(.drag-self)")) return;
    const start = { x: e.clientX, y: e.clientY, left: el.offsetLeft, top: el.offsetTop };
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) el.classList.add("dragging");
      moved = true;
      const [x, y] = clamp(start.left + dx, start.top + dy, el.offsetWidth, el.offsetHeight);
      el.style.left = x + "px";
      el.style.top = y + "px";
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.classList.remove("dragging");
      if (moved) {
        // Aimantation sur une grille de 8 px.
        const x = Math.round(el.offsetLeft / 8) * 8;
        const y = Math.round(el.offsetTop / 8) * 8;
        const [cx, cy] = clamp(x, y, el.offsetWidth, el.offsetHeight);
        el.style.left = cx + "px";
        el.style.top = cy + "px";
        onDrop(cx, cy);
      } else {
        onClick?.();
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up, { once: true });
    el.addEventListener("pointercancel", up, { once: true });
  });
}

/* ---------- Raccourcis ---------- */

function renderShortcut(item) {
  const app = byId.get(item.id);
  if (!app) return;
  const el = document.createElement("div");
  el.className = "shortcut";
  el.tabIndex = 0;
  el.title = app.name;
  el.dataset.id = item.id;
  el.style.left = item.x + "px";
  el.style.top = item.y + "px";
  el.append(appIcon(app, 56));
  const label = document.createElement("span");
  label.textContent = app.name;
  el.append(label);
  draggable(el, {
    onDrop: (x, y) => {
      item.x = x;
      item.y = y;
      save();
    },
    onClick: () => launch(app),
  });
  el.addEventListener("keydown", (e) => e.key === "Enter" && launch(app));
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showMenu(e.clientX, e.clientY, [
      { label: "Ouvrir", icon: "open", run: () => launch(app) },
      { label: "Retirer du bureau", icon: "trash", run: () => removeShortcut(item.id) },
    ]);
  });
  desk.append(el);
}

/** Première place libre sur une grille, en colonnes depuis la droite. */
function freeSpot(w, h) {
  const taken = [...desk.children].map((c) => c.getBoundingClientRect());
  for (let x = innerWidth - w - 32; x > 8; x -= w + 16) {
    for (let y = TOP + 16; y < innerHeight - h - BOTTOM; y += h + 16) {
      const r = { left: x, top: y, right: x + w, bottom: y + h };
      if (!taken.some((t) => t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top)) return [x, y];
    }
  }
  return clamp(innerWidth / 2, innerHeight / 2, w, h);
}

export function addShortcut(id) {
  if (prefs.desktop.some((s) => s.id === id)) {
    toast("Déjà sur le bureau");
    return;
  }
  const [x, y] = freeSpot(96, 104);
  const item = { id, x, y };
  prefs.desktop.push(item);
  save();
  renderShortcut(item);
}

function removeShortcut(id) {
  prefs.desktop = prefs.desktop.filter((s) => s.id !== id);
  save();
  desk.querySelector(`.shortcut[data-id="${CSS.escape(id)}"]`)?.remove();
}

/* ---------- Widgets ---------- */

function mountWidget(w) {
  const def = WIDGETS[w.type];
  if (!def) return;
  cleanups.get(w.uid)?.();
  desk.querySelector(`.widget[data-uid="${w.uid}"]`)?.remove();

  const [width, height] = def.sizes[w.size] ?? def.sizes.s;
  [w.x, w.y] = clamp(w.x, w.y, width, height);
  const el = document.createElement("section");
  el.className = `widget widget-${w.type} size-${w.size}`;
  el.dataset.uid = w.uid;
  el.setAttribute("aria-label", def.name);
  Object.assign(el.style, { left: w.x + "px", top: w.y + "px", width: width + "px", height: height + "px" });

  const body = document.createElement("div");
  body.className = "widget-body";
  const tools = document.createElement("div");
  tools.className = "widget-tools";
  tools.innerHTML = `
    <button class="icon-btn" data-act="size" title="${w.size === "l" ? "Réduire" : "Agrandir"}">${svg(w.size === "l" ? "shrink" : "expand")}</button>
    <button class="icon-btn" data-act="del" title="Supprimer">${svg("close")}</button>`;
  tools.querySelector('[data-act="size"]').addEventListener("click", () => resizeWidget(w));
  tools.querySelector('[data-act="del"]').addEventListener("click", () => removeWidget(w));
  el.append(body, tools);
  desk.append(el);

  const stop = def.render(body, w);
  cleanups.set(w.uid, typeof stop === "function" ? stop : () => {});

  draggable(el, {
    onDrop: (x, y) => {
      w.x = x;
      w.y = y;
      save();
    },
  });
  el.addEventListener("contextmenu", (e) => {
    if (e.target.closest("input, textarea")) return;
    e.preventDefault();
    e.stopPropagation();
    showMenu(e.clientX, e.clientY, [
      ...(def.menu ?? []),
      { label: w.size === "l" ? "Petite taille" : "Grande taille", icon: w.size === "l" ? "shrink" : "expand", run: () => resizeWidget(w) },
      { label: "Supprimer le widget", icon: "trash", run: () => removeWidget(w) },
    ]);
  });
}

function resizeWidget(w) {
  w.size = w.size === "l" ? "s" : "l";
  save();
  mountWidget(w);
}

function removeWidget(w) {
  cleanups.get(w.uid)?.();
  cleanups.delete(w.uid);
  prefs.widgets = prefs.widgets.filter((x) => x.uid !== w.uid);
  save();
  const el = desk.querySelector(`.widget[data-uid="${w.uid}"]`);
  if (!el) return;
  el.classList.add("leaving");
  setTimeout(() => el.remove(), 250);
}

export function addWidget(type, at) {
  const def = WIDGETS[type];
  const [width, height] = def.sizes.s;
  const [x, y] = at ? clamp(at.x - width / 2, at.y - height / 2, width, height) : freeSpot(width, height);
  const w = { uid: Math.random().toString(36).slice(2, 10), type, size: "s", x, y, data: {} };
  prefs.widgets.push(w);
  save();
  mountWidget(w);
  desk.querySelector(`.widget[data-uid="${w.uid}"]`)?.classList.add("arriving");
}

function defaultWidgets() {
  const cx = Math.round(innerWidth / 2);
  return [
    { uid: "clock", type: "clock", size: "l", x: 40, y: TOP + 24, data: {} },
    { uid: "weather", type: "weather", size: "s", x: 40, y: TOP + 244, data: {} },
    { uid: "search", type: "search", size: "l", x: cx - 280, y: Math.round(innerHeight * 0.3), data: {} },
  ];
}

/* ---------- Sélecteur de widgets ---------- */

let pickAt = null;

function openPicker(at) {
  pickAt = at;
  const list = picker.querySelector(".picker-list");
  list.innerHTML = "";
  for (const [type, def] of Object.entries(WIDGETS)) {
    const b = document.createElement("button");
    b.className = "picker-item press";
    b.innerHTML = `<span class="picker-icon">${svg(def.icon)}</span><span class="picker-text"><strong>${def.name}</strong><span>${def.desc}</span></span>`;
    b.addEventListener("click", () => {
      picker.close();
      addWidget(type, pickAt);
    });
    list.append(b);
  }
  picker.showModal();
  list.focus({ preventScroll: true });
}

/* ---------- Menu du bureau ---------- */

function desktopMenu(x, y) {
  closeAllPanels();
  showMenu(x, y, [
    { label: "Ajouter un widget", icon: "widgets", run: () => openPicker({ x, y }) },
    { label: "Fond d'écran et style", icon: "wallpaper", run: () => openSettings("wallpaper") },
    { label: "Paramètres OpenBook", icon: "settings", run: () => openSettings() },
  ]);
}

export function initDesktop({ onOpenSettings }) {
  openSettings = onOpenSettings;
  if (prefs.widgets === null) {
    prefs.widgets = defaultWidgets();
    save();
  }
  prefs.widgets.forEach(mountWidget);
  prefs.desktop.forEach(renderShortcut);
  // Les raccourcis d'applis Windows n'existent qu'une fois le menu Démarrer lu.
  onWindowsApps(() => {
    desk.querySelectorAll(".shortcut").forEach((s) => s.remove());
    prefs.desktop.forEach(renderShortcut);
  });

  desk.addEventListener("contextmenu", (e) => {
    if (e.target !== desk) return;
    e.preventDefault();
    desktopMenu(e.clientX, e.clientY);
  });

  // Appui long (écran tactile ou souris maintenue) sur le bureau vide.
  let timer = 0;
  let origin = null;
  desk.addEventListener("pointerdown", (e) => {
    if (e.target !== desk || e.button !== 0) return;
    origin = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => desktopMenu(origin.x, origin.y), 550);
  });
  const cancel = (e) => {
    if (e.type === "pointermove" && origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < 8) return;
    clearTimeout(timer);
  };
  desk.addEventListener("pointermove", cancel);
  desk.addEventListener("pointerup", cancel);
  desk.addEventListener("pointerleave", cancel);

  picker.addEventListener("click", (e) => e.target === picker && picker.close());
  picker.querySelector(".picker-close").addEventListener("click", () => picker.close());

  let t = 0;
  addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => prefs.widgets.forEach(mountWidget), 200);
  });
}
