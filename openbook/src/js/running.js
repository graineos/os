// Fenêtres ouvertes des autres applis, affichées à droite du dock
// (la barre des tâches Windows peut être masquée par le Mode Googlebook).
import { appIcon } from "./launch.js";
import { hasTauri, invoke } from "./tauri.js";
import { showMenu, toast } from "./ui.js";

const box = document.querySelector("#dock-running");
const sep = document.querySelector("#dock-sep");
let lastKey = "";

function basename(path) {
  return (path.split(/[\\/]/).pop() ?? "").replace(/\.exe$/i, "");
}

function render(list) {
  const key = JSON.stringify(list.map((w) => [w.id, w.title, w.active, w.minimized]));
  if (key === lastKey) return;
  lastKey = key;
  box.innerHTML = "";
  for (const w of list.slice(0, 12)) {
    const b = document.createElement("button");
    b.className = "dock-app dock-win press";
    b.classList.toggle("active", w.active);
    b.classList.toggle("minimized", w.minimized);
    b.title = w.title;
    b.setAttribute("aria-label", w.title);
    const name = basename(w.exe) || w.title;
    b.append(appIcon({ id: "w" + w.id, name, exe: w.exe, color: "#5f6368" }, 44));
    const bar = document.createElement("span");
    bar.className = "dock-bar";
    b.append(bar);
    b.addEventListener("click", () => focus(w));
    b.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showMenu(e.clientX, e.clientY - 8, [
        { label: "Afficher", icon: "open", run: () => focus(w) },
        { label: "Fermer la fenêtre", icon: "close", run: () => close(w) },
      ]);
    });
    box.append(b);
  }
  box.hidden = sep.hidden = list.length === 0;
}

async function focus(w) {
  try {
    await invoke("focus_window", { id: w.id });
  } catch (err) {
    toast(String(err?.message ?? err), { force: true });
  }
  refresh();
}

async function close(w) {
  try {
    await invoke("close_window", { id: w.id });
  } catch (err) {
    toast(String(err?.message ?? err), { force: true });
  }
  setTimeout(refresh, 400);
}

export async function refresh() {
  if (!hasTauri) return;
  try {
    render((await invoke("list_windows")) ?? []);
  } catch {
    /* ignoré */
  }
}

export function initRunning() {
  box.hidden = sep.hidden = true;
  refresh();
  setInterval(refresh, 1500);
  addEventListener("focus", refresh);
}
