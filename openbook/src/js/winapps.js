// Applis Windows installées : lues une fois au démarrage depuis le menu Démarrer.
import { registerWindowsApps } from "./apps.js";
import { hasTauri, invoke } from "./tauri.js";

const listeners = new Set();
export const onWindowsApps = (fn) => listeners.add(fn);

export async function loadWindowsApps() {
  if (!hasTauri) return;
  try {
    const list = await invoke("list_windows_apps");
    registerWindowsApps(list ?? []);
    listeners.forEach((fn) => fn());
  } catch {
    /* hors Windows : seulement les applis web */
  }
}
