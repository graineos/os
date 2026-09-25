// 3. Lanceur (façon ChromeOS / Pixel Launcher) : recherche unifiée — applis,
// fichiers, Paramètres Windows, calculs, conversions, web — navigable au
// clavier, rangée « Continuer » (fichiers récents) et grille alphabétique.
import { APPS, WIN_APPS, byId, normalize } from "./apps.js";
import { calculate, convert, formatNumber } from "./calc.js";
import { addFileShortcut, addShortcut } from "./desktop.js";
import { isPinned, pin, unpin } from "./dock.js";
import { svg } from "./icons.js";
import { appIcon, launch, nativeIcon, openUrl } from "./launch.js";
import { SETTINGS_PAGES } from "./settings-pages.js";
import { hasTauri, invoke, listen } from "./tauri.js";
import { closeAllPanels, closePanel, isOpen, menuOpen, openPanel, showMenu, toast } from "./ui.js";
import { onWindowsApps } from "./winapps.js";

const $ = (s) => document.querySelector(s);
const drawer = $("#drawer");
const launcher = $("#launcher");
const input = $("#search-input");
const grid = $("#app-grid");
const results = $("#results");
const cont = $("#continue");

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

/* ---------- Grille d'applis ---------- */

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
}

/* ---------- Continuer (fichiers récents) ---------- */

async function renderContinue() {
  cont.innerHTML = "";
  cont.hidden = true;
  if (!hasTauri) return;
  let files = [];
  try {
    files = (await invoke("files_recent")) ?? [];
  } catch {
    return;
  }
  if (!files.length) return;
  const h = document.createElement("h3");
  h.className = "grid-title";
  h.textContent = "Continuer";
  const row = document.createElement("div");
  row.className = "continue-row";
  for (const f of files) {
    const b = document.createElement("button");
    b.className = "chip-file press";
    b.title = f.name;
    const icon = document.createElement("span");
    icon.className = "chip-file-icon";
    icon.innerHTML = svg("file");
    nativeIcon(f.path, (url) => url && (icon.innerHTML = `<img src="${url}" alt="">`));
    const name = document.createElement("span");
    name.className = "chip-file-name";
    name.textContent = f.name;
    b.append(icon, name);
    b.addEventListener("click", () => openFile(f));
    b.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      fileMenu(f, e.clientX, e.clientY);
    });
    row.append(b);
  }
  cont.append(h, row);
  cont.hidden = false;
}

function fileMenu(f, x, y) {
  showMenu(x, y, [
    { label: "Ouvrir", icon: "open", run: () => openFile(f) },
    { label: "Ajouter au bureau", icon: "desktop", run: () => addFileShortcut(f) },
  ]);
}

async function openFile(f) {
  closeDrawer();
  try {
    await invoke("open_file", { path: f.path });
  } catch (err) {
    toast(String(err?.message ?? err), { force: true });
  }
}

/* ---------- Recherche unifiée ---------- */

let selected = 0;
let searchSeq = 0;

function row({ icon, iconEl, title, sub, badge, run, menu }) {
  const b = document.createElement("button");
  b.className = "res-row";
  b.setAttribute("role", "option");
  const i = document.createElement("span");
  i.className = "res-icon";
  if (iconEl) i.append(iconEl);
  else i.innerHTML = svg(icon);
  const text = document.createElement("span");
  text.className = "res-text";
  const t = document.createElement("span");
  t.className = "res-title";
  t.textContent = title;
  text.append(t);
  if (sub) {
    const s = document.createElement("span");
    s.className = "res-sub";
    s.textContent = sub;
    text.append(s);
  }
  b.append(i, text);
  if (badge) {
    const k = document.createElement("span");
    k.className = "res-badge";
    k.textContent = badge;
    b.append(k);
  }
  b.addEventListener("click", () => run());
  if (menu) {
    b.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      menu(e.clientX, e.clientY);
    });
  }
  b.addEventListener("pointermove", () => select([...results.querySelectorAll(".res-row")].indexOf(b)));
  b._run = run;
  return b;
}

function group(title, rows) {
  if (!rows.length) return null;
  const g = document.createElement("section");
  g.className = "res-group";
  const h = document.createElement("h3");
  h.className = "grid-title";
  h.textContent = title;
  g.append(h, ...rows);
  return g;
}

function select(i) {
  const rows = [...results.querySelectorAll(".res-row")];
  if (!rows.length) return;
  selected = (i + rows.length) % rows.length;
  rows.forEach((r, k) => r.setAttribute("aria-selected", String(k === selected)));
  rows[selected].scrollIntoView({ block: "nearest" });
}

async function copy(text) {
  try {
    await invoke("copy_text", { text });
  } catch {
    await navigator.clipboard?.writeText(text).catch(() => {});
  }
  toast(`Copié : ${text}`, { icon: "check", force: true });
}

function search() {
  const raw = input.value.trim();
  const q = normalize(raw);
  const seq = ++searchSeq;
  const empty = !q;
  grid.hidden = !empty;
  cont.hidden = !empty || !cont.childElementCount;
  results.hidden = empty;
  results.innerHTML = "";
  selected = 0;
  if (empty) return;

  const groups = [];
  const calc = calculate(raw);
  if (calc !== null) {
    const text = formatNumber(calc);
    groups.push(group("Calcul", [row({ icon: "calc", title: `= ${text}`, sub: `${raw} · Entrée pour copier`, run: () => copy(text) })]));
  }
  const conv = convert(raw);
  if (conv) {
    groups.push(group("Conversion", [row({ icon: "swap", title: conv.text, sub: "Entrée pour copier le résultat", run: () => copy(formatNumber(conv.value, 4)) })]));
  }

  const apps = [...APPS, ...WIN_APPS]
    .map((a) => ({ a, k: normalize(a.name) }))
    .filter(({ k }) => k.includes(q))
    .sort((x, y) => (x.k.startsWith(q) ? 0 : 1) - (y.k.startsWith(q) ? 0 : 1) || x.k.localeCompare(y.k))
    .slice(0, 6)
    .map(({ a }) =>
      row({
        iconEl: appIcon(a, 36),
        title: a.name,
        sub: a.kind === "win" ? "Appli Windows" : a.url ? "Appli web" : "Appli",
        menu: (x, y) => appMenu(a, x, y),
        run: () => {
          closeDrawer();
          launch(a);
        },
      }),
    );
  groups.push(group("Applis", apps));

  const pages = SETTINGS_PAGES.filter((p) => normalize(p.name).includes(q) || p.keywords.includes(q))
    .slice(0, 3)
    .map((p) =>
      row({
        icon: "settings",
        title: p.name,
        sub: "Paramètres Windows",
        run: () => {
          closeDrawer();
          invoke("open_settings", { page: p.page }).catch((err) => toast(String(err?.message ?? err), { force: true }));
        },
      }),
    );
  groups.push(group("Paramètres", pages));

  const filesSlot = document.createElement("div");
  groups.push(filesSlot);

  groups.push(
    group("Web", [
      row({
        icon: "web",
        title: `Rechercher « ${raw} » sur Google`,
        sub: "Google",
        run: () => {
          closeDrawer();
          openUrl("https://www.google.com/search?q=" + encodeURIComponent(raw), "la recherche");
        },
      }),
      row({ icon: "sparkle", title: `Demander à Gemini : « ${raw} »`, sub: "La question est copiée, colle-la avec Ctrl+V", run: askGemini }),
    ]),
  );

  results.append(...groups.filter(Boolean));
  select(0);
  $("#grid-empty").hidden = true;

  // Fichiers : recherche asynchrone dans l'index des dossiers personnels.
  if (hasTauri && q.length >= 2) {
    invoke("files_search", { query: raw })
      .then((files) => {
        if (seq !== searchSeq || !files?.length) return;
        const rows = files.map((f) => {
          const iconEl = document.createElement("span");
          iconEl.className = "res-file";
          iconEl.innerHTML = svg(f.dir ? "folder" : "file");
          nativeIcon(f.path, (url) => url && (iconEl.innerHTML = `<img src="${url}" alt="">`));
          return row({ iconEl, title: f.name, sub: f.folder, run: () => openFile(f), menu: (x, y) => fileMenu(f, x, y) });
        });
        const g = group("Fichiers", rows);
        filesSlot.replaceWith(g);
        select(selected);
      })
      .catch(() => {});
  }
}

export function openDrawer(query = "") {
  openPanel(drawer, launcher);
  input.value = query;
  search();
  renderContinue();
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
  input.addEventListener("input", search);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      select(selected + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      select(selected - 1);
    }
  });
  $("#search").addEventListener("submit", (e) => {
    e.preventDefault();
    const rows = results.querySelectorAll(".res-row");
    rows[selected]?._run?.();
  });
  $("#ask-gemini").addEventListener("click", askGemini);

  addEventListener("pointerdown", (e) => {
    if (!isOpen(drawer) || menuOpen()) return;
    if (!drawer.contains(e.target) && !launcher.contains(e.target) && !e.target.closest("#menu")) closeDrawer();
  });

  // Touche Windows (interceptée par le Rust) : ouvre ou ferme le lanceur,
  // éventuellement avec une recherche venue de Quick Insert.
  listen("launcher", (query) => {
    if (!query && isOpen(drawer) && document.hasFocus()) return closeDrawer();
    closeAllPanels();
    openDrawer(query || "");
  });
}
