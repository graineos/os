// Réglages rapides réels (façon SystemUI) : Wi-Fi et Bluetooth, réseaux Wi-Fi,
// volume (Core Audio) et lecteur multimédia de Windows.
import { svg } from "./icons.js";
import { hasTauri, invoke } from "./tauri.js";
import { toast } from "./ui.js";

const $ = (s) => document.querySelector(s);
const tiles = $(".qs-tiles");
const detail = $("#wifi-detail");
let mediaTimer = 0;

const fail = (err) => toast(String(err?.message ?? err), { force: true });

/* ---------- Radios ---------- */

let radios = { wifi: null, bluetooth: null };

function renderRadios() {
  for (const tile of document.querySelectorAll("[data-radio]")) {
    const on = radios[tile.dataset.radio];
    tile.setAttribute("aria-pressed", String(!!on));
    tile.classList.toggle("unavailable", on === null || on === undefined);
    if (tile.dataset.radio === "bluetooth") {
      tile.querySelector(".tile-state").textContent = on === null || on === undefined ? "Indisponible" : on ? "Activé" : "Désactivé";
    }
  }
  const net = $("#tile-net");
  if (radios.wifi === false) net.textContent = "Désactivé";
  else net.textContent = navigator.onLine ? "Connecté" : "Hors ligne";
  $("#wifi-switch").checked = !!radios.wifi;
}

async function refreshRadios() {
  if (!hasTauri) return renderRadios();
  try {
    radios = await invoke("radios_state");
  } catch {
    radios = { wifi: null, bluetooth: null };
  }
  renderRadios();
}

async function setRadio(kind, on) {
  try {
    await invoke("radio_set", { kind, on });
    radios[kind] = on;
    renderRadios();
    if (kind === "wifi" && !detail.hidden) setTimeout(renderNetworks, 1500);
  } catch (err) {
    fail(err);
  }
}

/* ---------- Réseaux Wi-Fi ---------- */

function bars(signal) {
  return `<span class="wifi-bars" style="--s:${Math.round(signal / 25)}">${svg("signal")}</span>`;
}

async function renderNetworks() {
  const list = $("#wifi-list");
  list.innerHTML = `<li class="wifi-empty">Recherche des réseaux…</li>`;
  let nets = [];
  try {
    nets = (await invoke("wifi_networks")) ?? [];
  } catch (err) {
    list.innerHTML = `<li class="wifi-empty"></li>`;
    list.firstChild.textContent = String(err?.message ?? err);
    return;
  }
  list.innerHTML = nets.length ? "" : `<li class="wifi-empty">Aucun réseau à portée</li>`;
  for (const n of nets.slice(0, 12)) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.className = "wifi-row";
    b.classList.toggle("connected", n.connected);
    b.innerHTML = `${bars(n.signal)}<span class="wifi-name"></span><span class="wifi-state"></span>${n.secured ? svg("lock2") : ""}`;
    b.querySelector(".wifi-name").textContent = n.ssid;
    b.querySelector(".wifi-state").textContent = n.connected ? "Connecté" : n.profile ? "Enregistré" : "";
    b.addEventListener("click", async () => {
      if (n.connected) return;
      if (!n.profile) return invoke("open_settings", { page: "wifi" }).catch(fail);
      try {
        await invoke("wifi_connect", { profile: n.profile });
        toast(`Connexion à ${n.ssid}…`, { icon: "wifi" });
        setTimeout(renderNetworks, 3000);
      } catch (err) {
        fail(err);
      }
    });
    li.append(b);
    list.append(li);
  }
}

function showDetail(on) {
  detail.hidden = !on;
  tiles.hidden = on;
  $("#brightness-row").hidden = on;
  $("#volume-row").hidden = on;
  if (on) renderNetworks();
}

/* ---------- Volume ---------- */

let volTimer = 0;
let muted = false;

function renderVolume(level, isMuted) {
  muted = isMuted;
  $("#volume").value = level;
  $("#volume-note").textContent = isMuted ? "Muet" : level + " %";
  $("#volume-mute").innerHTML = svg(isMuted || level === 0 ? "volMute" : level < 50 ? "volDown" : "volUp");
  $("#volume-mute").title = isMuted ? "Rétablir le son" : "Couper le son";
}

async function refreshVolume() {
  if (!hasTauri) return;
  try {
    const v = await invoke("volume_get");
    renderVolume(v.level, v.muted);
  } catch {
    $("#volume-row").classList.add("disabled");
  }
}

/* ---------- Multimédia ---------- */

async function refreshMedia() {
  const card = $("#media");
  if (!hasTauri) return;
  let m = null;
  try {
    m = await invoke("media_now");
  } catch {
    m = null;
  }
  card.hidden = !m || !m.title;
  if (card.hidden) return;
  $("#media-title").textContent = m.title;
  $("#media-artist").textContent = m.artist || m.app.replace(/\.exe$/i, "").split(/[\\/!]/).pop();
  $("#media-cover").style.backgroundImage = m.cover ? `url("${m.cover}")` : "";
  $("#media-cover").classList.toggle("empty", !m.cover);
  $("#media-toggle").innerHTML = svg(m.playing ? "pause" : "play");
  $("#media-toggle").title = m.playing ? "Pause" : "Lecture";
}

/** À l'ouverture du panneau : état réel des radios, du volume et du lecteur. */
export function refreshQuickSettings() {
  showDetail(false);
  refreshRadios();
  refreshVolume();
  refreshMedia();
  clearInterval(mediaTimer);
  mediaTimer = setInterval(refreshMedia, 3000);
}

export function stopQuickSettings() {
  clearInterval(mediaTimer);
}

export function initQuickSettings() {
  for (const tile of document.querySelectorAll("[data-radio]")) {
    tile.querySelector(".tile-main").addEventListener("click", () => {
      const kind = tile.dataset.radio;
      if (radios[kind] === null || radios[kind] === undefined) return invoke("open_settings", { page: kind }).catch(fail);
      setRadio(kind, !radios[kind]);
    });
  }
  $('[data-detail="wifi"]').addEventListener("click", () => showDetail(true));
  $("[data-detail-back]").addEventListener("click", () => showDetail(false));
  $("#wifi-switch").addEventListener("change", (e) => setRadio("wifi", e.target.checked));

  $("#volume").addEventListener("input", (e) => {
    const level = Number(e.target.value);
    renderVolume(level, false);
    clearTimeout(volTimer);
    volTimer = setTimeout(() => invoke("volume_set", { level }).catch(fail), 60);
  });
  $("#volume-mute").addEventListener("click", async () => {
    try {
      await invoke("volume_set", { muted: !muted });
      renderVolume(Number($("#volume").value), !muted);
    } catch (err) {
      fail(err);
    }
  });

  document.querySelectorAll("[data-media]").forEach((b) =>
    b.addEventListener("click", async () => {
      await invoke("media_control", { action: b.dataset.media }).catch(fail);
      setTimeout(refreshMedia, 400);
    }),
  );
  renderRadios();
}
