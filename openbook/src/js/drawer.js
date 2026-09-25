// 3. Tiroir d'applis (style Pixel Launcher) : recherche en pilule,
// grille alphabétique, clic droit pour épingler.
import { APPS, byId, normalize } from "./apps.js";
import { isPinned, pin, unpin } from "./dock.js";
import { appIcon, launch, openUrl } from "./launch.js";
import { closePanel, isOpen, menuOpen, openPanel, showMenu, toast } from "./ui.js";

const $ = (s) => document.querySelector(s);
const drawer = $("#drawer");
const launcher = $("#launcher");
const input = $("#search-input");
const grid = $("#app-grid");

function renderGrid() {
  grid.innerHTML = "";
  for (const app of APPS) {
    const b = document.createElement("button");
    b.className = "grid-app press";
    b.dataset.id = app.id;
    b.dataset.key = normalize(app.name);
    b.setAttribute("role", "listitem");
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
      const pinned = isPinned(app.id);
      showMenu(e.clientX, e.clientY, [
        { label: "Ouvrir", icon: "open", run: () => launch(app) },
        pinned
          ? { label: "Désépingler du dock", icon: "unpin", run: () => unpin(app.id) }
          : { label: "Épingler au dock", icon: "pin", run: () => pin(app.id) },
      ]);
    });
    grid.append(b);
  }
}

function filter() {
  const q = normalize(input.value);
  let shown = 0;
  for (const b of grid.children) {
    const match = !q || b.dataset.key.includes(q);
    b.hidden = !match;
    if (match) shown++;
  }
  $("#grid-empty").hidden = shown > 0;
}

export function openDrawer() {
  openPanel(drawer, launcher);
  input.value = "";
  filter();
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
      await navigator.clipboard.writeText(q);
      toast("Question copiée, colle-la avec Ctrl+V", { icon: "sparkle", force: true, ms: 5000 });
    } catch {
      toast("Copie impossible : retape ta question dans Gemini", { force: true });
    }
  }
  launch(byId.get("gemini"));
}

export function initDrawer() {
  renderGrid();
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
}
