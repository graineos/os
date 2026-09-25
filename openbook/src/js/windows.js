// Fenêtres ouvertes des autres applis, relevées toutes les 1,5 s.
import { hasTauri, invoke } from "./tauri.js";
import { toast } from "./ui.js";

export let openWindows = [];
const listeners = new Set();
export const onWindows = (fn) => listeners.add(fn);
let lastKey = "";

export async function refreshWindows() {
  if (!hasTauri) return;
  try {
    const list = (await invoke("list_windows")) ?? [];
    const key = JSON.stringify(list.map((w) => [w.id, w.title, w.active, w.minimized]));
    if (key === lastKey) return;
    lastKey = key;
    openWindows = list;
    listeners.forEach((fn) => fn(list));
  } catch {
    /* ignoré */
  }
}

export function exeName(path) {
  return (path.split(/[\\/]/).pop() ?? "").replace(/\.exe$/i, "");
}

async function run(cmd, args, delay = 200) {
  try {
    await invoke(cmd, args);
  } catch (err) {
    toast(String(err?.message ?? err), { force: true });
  }
  setTimeout(refreshWindows, delay);
}

export const focusWindow = (w) => run("focus_window", { id: w.id });
export const closeWindow = (w) => run("close_window", { id: w.id }, 500);
export const snapWindow = (w, mode) => run("snap_window", { id: w.id, mode });

/** Actions d'une fenêtre pour un menu contextuel (façon menu d'agrandissement d'Android). */
export function windowActions(w) {
  return [
    { label: "Ancrer à gauche", icon: "snapLeft", run: () => snapWindow(w, "left") },
    { label: "Ancrer à droite", icon: "snapRight", run: () => snapWindow(w, "right") },
    { label: "Agrandir", icon: "expand", run: () => snapWindow(w, "max") },
    { label: "Réduire", icon: "minus", run: () => snapWindow(w, "min") },
    { label: "Fermer la fenêtre", icon: "close", run: () => closeWindow(w) },
  ];
}

export function initWindows() {
  refreshWindows();
  setInterval(refreshWindows, 1500);
  addEventListener("focus", refreshWindows);
}
