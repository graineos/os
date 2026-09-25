// Miniatures en direct des fenêtres (DWM) : le Rust les dessine par-dessus
// OpenBook, aux emplacements des éléments HTML donnés.
import { hasTauri, invoke } from "./tauri.js";

let owner = null;

/** Affiche les miniatures de `items` ({ id, el }) pour le composant `who`. */
export function showThumbs(who, items) {
  if (!hasTauri) return;
  owner = who;
  const dpr = devicePixelRatio || 1;
  const slots = items.map(({ id, el }) => {
    const r = el.getBoundingClientRect();
    return { id, x: Math.round(r.left * dpr), y: Math.round(r.top * dpr), w: Math.round(r.width * dpr), h: Math.round(r.height * dpr) };
  });
  invoke("set_thumbnails", { slots }).catch(() => {});
}

export function clearThumbs(who) {
  if (!hasTauri || (who && owner !== who)) return;
  owner = null;
  invoke("clear_thumbnails").catch(() => {});
}
