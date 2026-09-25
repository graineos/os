// Fond d'écran personnel : l'image choisie est réduite à la taille de l'écran,
// gardée sur cet ordinateur (IndexedDB) et ses couleurs Material You en sont
// extraites (QuantizerCelebi + Score), comme sur un Pixel ou un Googlebook.
import { argbFromRgb, hexFromArgb, QuantizerCelebi, Score } from "../vendor/mcu.js";

const DB = "openbook";
const STORE = "files";
const KEY = "wallpaper";

let image = null; // ImageBitmap de l'image courante
const listeners = new Set();
export const onUserWallpaper = (fn) => listeners.add(fn);
export const userImage = () => image;

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

/** Couleur source dominante de l'image (algorithme Material You). */
function seedOf(bitmap) {
  const size = 112;
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) continue;
    pixels.push(argbFromRgb(data[i], data[i + 1], data[i + 2]));
  }
  const ranked = Score.score(QuantizerCelebi.quantize(pixels, 128));
  return hexFromArgb(ranked[0] ?? 0xff4285f4);
}

/** Importe un fichier image ; renvoie la couleur source extraite. */
export async function importImage(file) {
  const original = await createImageBitmap(file);
  // Réduction à la définition de l'écran (au plus 3840 px de large).
  const maxW = Math.min(3840, Math.round(screen.width * (devicePixelRatio || 1)) || 1920);
  const scale = Math.min(1, maxW / original.width);
  const w = Math.round(original.width * scale);
  const h = Math.round(original.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext("2d").drawImage(original, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  await tx("readwrite", (s) => s.put(blob, KEY));
  image = await createImageBitmap(blob);
  const seed = seedOf(image);
  listeners.forEach((fn) => fn(image));
  return seed;
}

export async function loadUserImage() {
  try {
    const blob = await tx("readonly", (s) => s.get(KEY));
    image = blob ? await createImageBitmap(blob) : null;
  } catch {
    image = null;
  }
  listeners.forEach((fn) => fn(image));
  return image;
}
