// Pont vers Tauri. Dans la page de démo (navigateur, sans Windows),
// la page parente fournit une simulation : window.parent.__TAURI_MOCK__.

function resolve() {
  if (window.__TAURI__) return window.__TAURI__;
  try {
    if (window.parent !== window && window.parent.__TAURI_MOCK__) return window.parent.__TAURI_MOCK__;
  } catch {
    /* parent d'une autre origine : pas de simulation */
  }
  return null;
}

const T = resolve();

export const hasTauri = T !== null;
export const isDemo = hasTauri && !window.__TAURI__;

export async function invoke(cmd, args) {
  if (!T) throw new Error("OpenBook doit tourner dans son application Windows pour ça.");
  return T.core.invoke(cmd, args);
}

export function appWindow() {
  return T?.window?.getCurrentWindow?.() ?? null;
}

/** Écoute un événement envoyé par le Rust (quick-insert, bubble-open, glow…). */
export function listen(event, handler) {
  return T?.event?.listen?.(event, (e) => handler(e.payload)) ?? Promise.resolve(() => {});
}
