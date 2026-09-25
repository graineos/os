// 1. Barre du haut : heure et date à gauche, icônes d'état à droite,
// panneau Réglages rapides et notifications (style Pixel).
import { batterySvg, svg } from "./icons.js";
import { prefs, save } from "./store.js";
import { initQuickSettings, refreshQuickSettings, stopQuickSettings } from "./quicksettings.js";
import { openSettings, syncWindows } from "./settings.js";
import { isDark, setDark } from "./theme.js";
import { appWindow, invoke } from "./tauri.js";
import { closePanel, confirmAction, isOpen, onNotificationsChange, togglePanel, toast } from "./ui.js";

const $ = (s) => document.querySelector(s);
const qs = $("#qs");
const status = $("#status");

/* ---------- Heure et date ---------- */

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const longDateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function tick() {
  const now = new Date();
  $("#clock").textContent = timeFmt.format(now);
  $("#date").textContent = dateFmt.format(now);
  $("#qs-time").textContent = timeFmt.format(now);
  const long = longDateFmt.format(now);
  $("#qs-date").textContent = long[0].toUpperCase() + long.slice(1);
  setTimeout(tick, 60_000 - (Date.now() % 60_000) + 20);
}

/* ---------- Réseau ---------- */

function renderNetwork() {
  const on = navigator.onLine;
  $("#net-icon").innerHTML = svg(on ? "wifi" : "wifiOff");
  $("#net-icon").title = on ? "Connecté" : "Hors ligne";
}

/* ---------- Batterie réelle ---------- */

export const battery = { api: null, listeners: new Set() };

/** Un PC fixe expose une « batterie » pleine, en charge, sans autonomie. */
function hasRealBattery(b) {
  if (!b) return false;
  const looksLikeMains = b.charging && b.level === 1 && b.chargingTime === 0 && b.dischargingTime === Infinity;
  return !looksLikeMains || battery.seenChange;
}

function renderBattery() {
  const b = battery.api;
  const show = hasRealBattery(b);
  $("#bat-icon").hidden = $("#bat-text").hidden = !show;
  if (!show) {
    $("#qs-battery").textContent = "";
    status.title = "Réglages rapides et notifications";
    return;
  }
  const pct = Math.round(b.level * 100);
  $("#bat-icon").innerHTML = batterySvg(b.level, b.charging);
  $("#bat-text").textContent = pct + " %";
  status.title = `Batterie ${pct} %${b.charging ? " (en charge)" : ""} — Réglages rapides`;
  $("#qs-battery").innerHTML = `${batterySvg(b.level, b.charging)}<span>${pct} %${b.charging ? " · en charge" : ""}</span>`;
}

async function initBattery() {
  if (!navigator.getBattery) return renderBattery();
  try {
    battery.api = await navigator.getBattery();
    for (const ev of ["levelchange", "chargingchange"]) {
      battery.api.addEventListener(ev, () => {
        battery.seenChange = true;
        renderBattery();
        battery.listeners.forEach((fn) => fn(ev, battery.api));
      });
    }
  } catch {
    battery.api = null;
  }
  renderBattery();
}

/* ---------- Tuiles ---------- */

function renderTiles() {
  const states = {
    dark: [isDark(), isDark() ? "Activé" : "Désactivé"],
    dnd: [prefs.dnd, prefs.dnd ? "Activé" : "Désactivé"],
    fullscreen: [prefs.fullscreen, prefs.fullscreen ? "Par-dessus Windows" : "Barre des tâches visible"],
  };
  for (const tile of qs.querySelectorAll(".tile[data-tile]")) {
    const [on, label] = states[tile.dataset.tile];
    tile.setAttribute("aria-pressed", String(on));
    tile.querySelector(".tile-state").textContent = label;
  }
  $("#dnd-indicator").hidden = !prefs.dnd;
}

/**
 * Plein écran : OpenBook recouvre tout l'écran, barre des tâches comprise.
 * Sinon : il occupe la zone de travail et reste sous les autres fenêtres,
 * comme un fond d'écran interactif.
 */
export async function applyWindowMode() {
  const win = appWindow();
  if (!win) return;
  try {
    if (prefs.fullscreen) {
      await win.setAlwaysOnBottom(false);
      await win.setFullscreen(true);
    } else {
      await win.setFullscreen(false);
      await win.maximize();
      await win.setAlwaysOnBottom(true);
    }
  } catch (err) {
    toast(`Mode d'affichage : ${err?.message ?? err}`, { force: true });
  }
}

const tileActions = {
  dark: () => {
    setDark(!isDark());
    syncWindows();
  },
  dnd: () => {
    prefs.dnd = !prefs.dnd;
    save();
    if (!prefs.dnd) toast("Ne pas déranger désactivé", { icon: "bell" });
  },
  fullscreen: () => {
    prefs.fullscreen = !prefs.fullscreen;
    save();
    applyWindowMode();
  },
};

/* ---------- Alimentation ---------- */

const POWER = {
  lock: { title: "Verrouiller l'ordinateur ?", text: "Windows affichera l'écran de verrouillage.", ok: "Verrouiller", icon: "lock" },
  restart: { title: "Redémarrer ?", text: "Enregistre ton travail : toutes les applis vont se fermer.", ok: "Redémarrer", icon: "restart", danger: true },
  shutdown: { title: "Éteindre ?", text: "Enregistre ton travail : toutes les applis vont se fermer.", ok: "Éteindre", icon: "power", danger: true },
  quit: { title: "Quitter OpenBook ?", text: "Tu retrouveras le bureau Windows. Relance OpenBook depuis le menu Démarrer.", ok: "Quitter", icon: "exit" },
};

async function runPower(action) {
  const ok = await confirmAction(POWER[action]);
  if (!ok) return;
  closePanel(qs);
  try {
    if (action === "quit") {
      const win = appWindow();
      if (!win) throw new Error("fenêtre introuvable");
      await win.close();
    } else {
      await invoke("power", { action });
    }
  } catch (err) {
    toast(`${POWER[action].ok} : ${err?.message ?? err}`, { force: true });
  }
}

/* ---------- Luminosité et volume ---------- */

let brightnessTimer = 0;

async function refreshBrightness() {
  const input = $("#brightness");
  let level = null;
  try {
    level = await invoke("get_brightness");
  } catch {
    level = null;
  }
  const ok = typeof level === "number";
  input.disabled = !ok;
  $("#brightness-row").classList.toggle("disabled", !ok);
  $("#brightness-note").textContent = ok ? level + " %" : "Écran externe : réglé par l'écran";
  if (ok) input.value = level;
}

function initBrightness() {
  const input = $("#brightness");
  input.addEventListener("input", () => {
    $("#brightness-note").textContent = input.value + " %";
    clearTimeout(brightnessTimer);
    brightnessTimer = setTimeout(() => {
      invoke("set_brightness", { level: Number(input.value) }).catch((err) => toast(String(err?.message ?? err), { force: true }));
    }, 250);
  });
}

/* ---------- Mise en place ---------- */

export function initTopbar() {
  tick();
  renderNetwork();
  addEventListener("online", renderNetwork);
  addEventListener("offline", renderNetwork);
  initBattery();
  renderTiles();

  initBrightness();
  initQuickSettings();
  status.addEventListener("click", () => {
    togglePanel(qs, status);
    if (isOpen(qs)) {
      refreshBrightness();
      refreshQuickSettings();
    } else stopQuickSettings();
  });
  $("#qs-settings").addEventListener("click", () => openSettings());
  qs.querySelectorAll("[data-settings]").forEach((b) =>
    b.addEventListener("click", () => {
      closePanel(qs);
      invoke("open_settings", { page: b.dataset.settings }).catch((err) => toast(String(err?.message ?? err), { force: true }));
    }),
  );
  qs.querySelectorAll(".tile[data-tile]").forEach((tile) =>
    tile.addEventListener("click", () => {
      tileActions[tile.dataset.tile]();
      renderTiles();
    }),
  );
  qs.querySelectorAll("[data-power]").forEach((b) => b.addEventListener("click", () => runPower(b.dataset.power)));

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderTiles);
  onNotificationsChange((n) => status.classList.toggle("has-notifs", n > 0));

  addEventListener("pointerdown", (e) => {
    if (isOpen(qs) && !qs.contains(e.target) && !status.contains(e.target) && !e.target.closest("#confirm")) closePanel(qs);
  });
}
