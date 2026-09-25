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
  const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  let windows = [
    { id: 101, title: "Boîte de réception (3) - angel@gmail.com - Gmail", exe: CHROME, active: true, minimized: false },
    { id: 102, title: "Lofi Girl - beats to relax/study to - YouTube", exe: CHROME, active: false, minimized: false },
    { id: 103, title: "Documents", exe: "C:\\Windows\\explorer.exe", active: false, minimized: false },
    { id: 104, title: "Téléchargements", exe: "C:\\Windows\\explorer.exe", active: false, minimized: true },
    { id: 105, title: "Spotify Premium", exe: "C:\\Users\\angel\\AppData\\Roaming\\Spotify\\Spotify.exe", active: false, minimized: false },
    { id: 106, title: "liste de courses.txt - Bloc-notes", exe: "C:\\Windows\\notepad.exe", active: false, minimized: false },
  ];
  let volume = { level: 42, muted: false };
  let radios = { wifi: true, bluetooth: false };
  let media = { title: "Midnight City", artist: "M83", app: "Spotify.exe", playing: true, cover: null };
  const HOME = "C:\\Users\\angel";
  const FILES = [
    ["Rapport annuel 2026.docx", "Documents"], ["Budget vacances.xlsx", "Documents"], ["CV Angel Leclerc.pdf", "Documents"],
    ["Présentation OpenBook.pptx", "Documents"], ["Photo plage.jpg", "Pictures"], ["Facture EDF septembre.pdf", "Downloads"],
    ["Notes réunion.txt", "Desktop"], ["Projet OpenDoor", "Documents"],
  ].map(([name, folder]) => ({ name, folder, path: `${HOME}\\${folder}\\${name}`, dir: !name.includes("."), modified: 0 }));
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
    volume_get: () => volume,
    volume_set: ({ level, muted }) => {
      if (level !== undefined) volume = { level, muted: false };
      if (muted !== undefined) volume = { ...volume, muted };
      log(`volume_set → ${JSON.stringify(volume)}`);
    },
    radios_state: () => radios,
    radio_set: ({ kind, on }) => {
      radios = { ...radios, [kind]: on };
      log(`radio_set → ${kind} ${on ? "activé" : "coupé"}`);
    },
    wifi_networks: () => [
      { ssid: "Livebox-Angel", signal: 92, secured: true, connected: true, profile: "Livebox-Angel" },
      { ssid: "Freebox-Voisin", signal: 61, secured: true, connected: false, profile: null },
      { ssid: "Café du coin", signal: 44, secured: false, connected: false, profile: "Café du coin" },
    ],
    wifi_connect: ({ profile }) => log(`wifi_connect → ${profile}`),
    media_now: () => media,
    media_control: ({ action }) => {
      if (action === "toggle") media = { ...media, playing: !media.playing };
      log(`media_control → ${action}`);
    },
    files_search: ({ query }) => FILES.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    files_recent: () => FILES.slice(0, 5),
    open_file: ({ path }) => log(`open_file → ${path}`),
    set_thumbnails: ({ slots }) => log(`set_thumbnails → ${slots.length} miniature(s)`),
    clear_thumbnails: () => {},
    snap_window: ({ id, mode }) => {
      if (mode === "min") windows = windows.map((w) => (w.id === id ? { ...w, minimized: true, active: false } : w));
      log(`snap_window → ${id} ${mode}`);
    },
    qi_history: () => ["Rendez-vous jeudi 14 h au bureau", "https://angel-beta.fr/opendoor", "06 12 34 56 78"],
    qi_clear: () => {},
    qi_insert: ({ text }) => {
      document.getElementById("qi").hidden = true;
      log(`qi_insert → « ${text} » collé dans l'appli active`);
    },
    qi_close: () => (document.getElementById("qi").hidden = true),
    show_launcher: ({ query }) => {
      document.getElementById("qi").hidden = true;
      emit("launcher", query ?? "");
    },
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
        options.autostart && "ouverture au démarrage",
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
      const q = document.getElementById("qi");
      q.style.left = innerWidth / 2 - 220 + "px";
      q.style.top = "140px";
      q.hidden = false;
      q.focus();
      emit("qi-open");
    } else if (what === "win") {
      emit("launcher", "");
    } else if (what === "wintab") {
      emit("overview");
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
