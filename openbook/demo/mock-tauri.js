// Simulation minimale de window.__TAURI__ pour tester l'interface d'OpenBook
// dans un navigateur ordinaire. src/js/tauri.js la lit via window.parent.
(() => {
  const params = new URLSearchParams(location.search);
  if (params.has("clean")) document.documentElement.classList.add("clean");
  addEventListener("DOMContentLoaded", () => {
    if (params.has("clean")) document.body.classList.add("clean");
  });

  const calls = [];
  function log(text) {
    calls.push(text);
    console.info("[OpenBook démo]", text);
    const el = document.getElementById("last");
    if (el) el.textContent = text;
  }

  const commands = {
    open_app: ({ url }) => {
      if (!/^https:\/\//.test(url)) throw "Seules les adresses https:// sont acceptées.";
      log(`open_app → chrome.exe --app=${url}`);
      return "app";
    },
    open_files: () => log("open_files → explorer.exe"),
    power: ({ action }) => log(`power → ${action} (simulé, rien n'est éteint)`),
  };

  const win = {
    fullscreen: true,
    async setFullscreen(v) { this.fullscreen = v; log(`fenêtre : plein écran = ${v}`); },
    async isFullscreen() { return this.fullscreen; },
    async maximize() { log("fenêtre : agrandie"); },
    async setAlwaysOnBottom(v) { log(`fenêtre : toujours en dessous = ${v}`); },
    async setFocus() {},
    async close() { log("fenêtre : fermée (OpenBook quitterait ici)"); },
  };

  window.__TAURI_MOCK__ = {
    core: {
      async invoke(cmd, args = {}) {
        const fn = commands[cmd];
        if (!fn) throw `Commande inconnue : ${cmd}`;
        return fn(args);
      },
    },
    window: { getCurrentWindow: () => win },
    calls,
  };
})();
