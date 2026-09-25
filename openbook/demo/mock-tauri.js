// Simulation de window.__TAURI__ pour tester OpenBook dans un navigateur.
// src/js/tauri.js la lit via window.parent.__TAURI_MOCK__. Les fenêtres
// « bubble » et « glow » sont des iframes de cette page.
(() => {
  const params = new URLSearchParams(location.search);
  addEventListener("DOMContentLoaded", () => {
    if (params.has("clean")) document.body.classList.add("clean");
    document.querySelectorAll("[data-sim]").forEach((b) =>
      b.addEventListener("click", () => simulate(b.dataset.sim)),
    );
  });

  const calls = [];
  function log(text) {
    calls.push(text);
    console.info("[OpenBook démo]", text);
    const el = document.getElementById("last");
    if (el) el.textContent = text;
  }

  /* ---------- Événements ---------- */
  const listeners = new Map();
  function emit(name, payload) {
    (listeners.get(name) ?? []).forEach((cb) => cb({ payload }));
  }

  /* ---------- Données factices ---------- */
  const winApps = [
    "Bloc-notes", "Calculatrice", "Paint", "Spotify", "VLC media player", "Word", "Excel",
    "Visual Studio Code", "Steam", "Discord", "Outil Capture d'écran", "Terminal",
  ].map((name) => ({ name, path: `C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\${name}.lnk` }));
  let windows = [
    { id: 101, title: "Bloc-notes — liste de courses.txt", exe: "C:\\Windows\\notepad.exe", active: false, minimized: false },
    { id: 102, title: "Spotify Premium", exe: "C:\\Users\\angel\\AppData\\Roaming\\Spotify\\Spotify.exe", active: false, minimized: true },
    { id: 103, title: "Explorateur de fichiers — Documents", exe: "C:\\Windows\\explorer.exe", active: false, minimized: false },
  ];
  let googlebook = false;

  const commands = {
    open_app: ({ url }) => {
      if (!/^https:\/\//.test(url)) throw "Seules les adresses https:// sont acceptées.";
      log(`open_app → chrome.exe --app=${url}`);
      return "app";
    },
    open_files: () => log("open_files → explorer.exe"),
    open_settings: ({ page }) => log(`open_settings → ${page}`),
    power: ({ action }) => log(`power → ${action} (simulé, rien n'est éteint)`),
    list_windows_apps: () => winApps,
    launch_windows_app: ({ path }) => log(`launch_windows_app → ${path}`),
    app_icons: () => ({}),
    list_windows: () => windows,
    focus_window: ({ id }) => {
      windows = windows.map((w) => ({ ...w, active: w.id === id, minimized: w.id === id ? false : w.minimized }));
      log(`focus_window → ${id}`);
    },
    close_window: ({ id }) => {
      windows = windows.filter((w) => w.id !== id);
      log(`close_window → ${id}`);
    },
    copy_text: ({ text }) => log(`copy_text → « ${text} »`),
    volume: ({ action }) => log(`volume → ${action}`),
    get_brightness: () => 70,
    set_brightness: ({ level }) => log(`set_brightness → ${level} %`),
    googlebook_status: () => googlebook,
    googlebook_apply: ({ options }) => {
      googlebook = true;
      const parts = [
        options.theme && `thème ${options.dark ? "sombre" : "clair"}`,
        options.accent && `accent ${options.palette[3]}`,
        options.wallpaper && `fond d'écran (${Math.round(options.wallpaper.length / 1024)} Ko)`,
        options.autohide && "barre des tâches masquée",
      ].filter(Boolean);
      log(`googlebook_apply → ${parts.join(", ")}`);
    },
    googlebook_restore: () => {
      googlebook = false;
      log("googlebook_restore → réglages Windows d'origine");
      return true;
    },
    set_features: ({ features }) => log(`set_features → ${JSON.stringify(features)}`),
    hide_bubble: () => {
      document.getElementById("bubble").hidden = true;
      emit("glow", "pulse-off");
    },
  };

  function simulate(what) {
    if (what === "shake") {
      const b = document.getElementById("bubble");
      b.style.left = innerWidth / 2 - 120 + "px";
      b.style.top = innerHeight / 2 - 60 + "px";
      b.hidden = false;
      b.focus();
      emit("bubble-open");
      emit("glow", "pulse-on");
    } else if (what === "caps") {
      emit("quick-insert");
    } else if (what === "charge") {
      const glow = document.getElementById("glow").contentWindow;
      glow.document.querySelector("#bar").dispatchEvent(new CustomEvent("demo-battery", { detail: 0.64 }));
    }
  }

  const win = {
    fullscreen: true,
    label: "main",
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
    event: {
      async listen(name, cb) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(cb);
        return () => listeners.set(name, listeners.get(name).filter((f) => f !== cb));
      },
    },
    window: { getCurrentWindow: () => win },
    calls,
    simulate,
    emit,
  };
})();
