// Widgets du bureau : Horloge, Coup d'œil, Météo (Open-Meteo), Recherche, Pense-bête.
// Chaque widget a deux tailles : s (petite) et l (grande).
import { byId } from "./apps.js";
import { svg } from "./icons.js";
import { launch, openUrl } from "./launch.js";
import { prefs, save } from "./store.js";
import { invoke } from "./tauri.js";
import { toast } from "./ui.js";

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const longDate = (d) => cap(new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d));
const dayName = (d) => cap(new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(d).replace(".", ""));

/* ---------- Météo (partagée par Météo et Coup d'œil) ---------- */

const CODES = [
  [[0], "Ensoleillé", "sun"],
  [[1, 2], "Éclaircies", "partly"],
  [[3], "Couvert", "cloud"],
  [[45, 48], "Brouillard", "fog"],
  [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], "Pluie", "rain"],
  [[71, 73, 75, 77, 85, 86], "Neige", "snow"],
  [[95, 96, 99], "Orage", "storm"],
];

export function describe(code) {
  const hit = CODES.find(([codes]) => codes.includes(code));
  return hit ? { label: hit[1], icon: hit[2] } : { label: "—", icon: "cloud" };
}

let weatherCache = null; // { at, key, data }
const weatherListeners = new Set();

export function onWeather(fn) {
  weatherListeners.add(fn);
  return () => weatherListeners.delete(fn);
}

export async function getWeather(force = false) {
  const loc = prefs.weather;
  if (!loc) return null;
  const key = `${loc.lat},${loc.lon}`;
  if (!force && weatherCache && weatherCache.key === key && Date.now() - weatherCache.at < 30 * 60_000) {
    return weatherCache.data;
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&timezone=auto&forecast_days=4";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo indisponible");
  const data = await res.json();
  weatherCache = { at: Date.now(), key, data };
  weatherListeners.forEach((fn) => fn(data));
  return data;
}

async function setLocation(loc) {
  prefs.weather = loc;
  save();
  weatherCache = null;
  try {
    await getWeather(true);
  } catch {
    /* affiché par le widget */
  }
  weatherListeners.forEach((fn) => fn(weatherCache?.data ?? null));
}

async function findCity(name) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&name=${encodeURIComponent(name)}`,
  );
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) throw new Error("Ville introuvable");
  return { lat: r.latitude, lon: r.longitude, name: r.name };
}

function useMyPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Position indisponible"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: "Ma position" }),
      () => reject(new Error("Position refusée ou indisponible")),
      { timeout: 10_000, maximumAge: 3_600_000 },
    );
  });
}

export function askLocation() {
  prefs.weather = null;
  save();
  weatherCache = null;
  weatherListeners.forEach((fn) => fn(null));
}

/* ---------- Définitions ---------- */

function clockFace(now) {
  const h = (now.getHours() % 12) + now.getMinutes() / 60;
  const m = now.getMinutes() + now.getSeconds() / 60;
  const s = now.getSeconds();
  // Cadran « cookie » festonné (Material 3 Expressive).
  let d = "";
  for (let i = 0; i <= 360; i += 3) {
    const t = (i * Math.PI) / 180;
    const r = 46 * (1 + 0.06 * Math.cos(9 * t));
    d += `${i ? "L" : "M"}${(50 + r * Math.cos(t)).toFixed(2)} ${(50 + r * Math.sin(t)).toFixed(2)}`;
  }
  const hand = (deg, len, width, cls) =>
    `<line class="${cls}" x1="50" y1="50" x2="${50 + len * Math.sin((deg * Math.PI) / 180)}" y2="${50 - len * Math.cos((deg * Math.PI) / 180)}" stroke-width="${width}" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 100 100" class="clock-face" aria-hidden="true">
    <path d="${d}Z" class="face"/>
    ${hand(h * 30, 22, 7, "hh")}${hand(m * 6, 32, 5, "mh")}${hand(s * 6, 36, 1.6, "sh")}
    <circle cx="50" cy="50" r="3.2" class="pin"/>
  </svg>`;
}

export const WIDGETS = {
  clock: {
    name: "Horloge",
    icon: "clock",
    desc: "L'heure en grand, avec un cadran expressif.",
    sizes: { s: [220, 132], l: [320, 200] },
    render(el, w) {
      const tick = () => {
        const now = new Date();
        el.innerHTML =
          w.size === "l"
            ? `<div class="wg-clock-l">${clockFace(now)}<div><div class="wg-time">${timeFmt.format(now)}</div><div class="wg-sub">${longDate(now)}</div></div></div>`
            : `<div class="wg-time big">${timeFmt.format(now)}</div><div class="wg-sub">${longDate(now)}</div>`;
      };
      tick();
      const id = setInterval(tick, w.size === "l" ? 1000 : 10_000);
      return () => clearInterval(id);
    },
  },

  glance: {
    name: "Coup d'œil",
    icon: "calendar",
    desc: "Date, météo et batterie d'un seul regard.",
    sizes: { s: [300, 112], l: [400, 168] },
    render(el, w) {
      const draw = async () => {
        const now = new Date();
        const h = now.getHours();
        const hello = h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
        let meteo = "";
        try {
          const data = await getWeather();
          if (data) {
            const d = describe(data.current.weather_code);
            meteo = `<span class="chip">${svg(d.icon)}${Math.round(data.current.temperature_2m)}°</span>`;
          }
        } catch {
          /* sans météo */
        }
        let bat = "";
        try {
          const b = await navigator.getBattery?.();
          if (b && !(b.charging && b.level === 1)) bat = `<span class="chip">${Math.round(b.level * 100)} %</span>`;
        } catch {
          /* pas de batterie */
        }
        el.innerHTML = `${w.size === "l" ? `<div class="wg-hello">${hello}</div>` : ""}
          <div class="wg-date">${longDate(now)}</div>
          <div class="wg-chips">${meteo}${bat}</div>`;
      };
      draw();
      const id = setInterval(draw, 60_000);
      const off = onWeather(draw);
      return () => {
        clearInterval(id);
        off();
      };
    },
  },

  weather: {
    name: "Météo",
    icon: "partly",
    desc: "Open-Meteo. Ta position n'est utilisée que si tu l'autorises.",
    sizes: { s: [230, 150], l: [360, 250] },
    render(el, w) {
      const form = () => {
        el.innerHTML = `
          <div class="wg-title">${svg("partly")}Météo</div>
          <form class="wg-city" data-nodrag>
            <input name="city" placeholder="Ta ville" aria-label="Ville" autocomplete="off">
            <button class="icon-btn filled" title="Valider">${svg("check")}</button>
          </form>
          <button class="text-btn wg-loc" data-nodrag>${svg("location")}Utiliser ma position</button>`;
        el.querySelector("form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const name = e.target.city.value.trim();
          if (!name) return;
          try {
            await setLocation(await findCity(name));
          } catch (err) {
            toast(err.message, { force: true });
          }
        });
        el.querySelector(".wg-loc").addEventListener("click", async () => {
          try {
            await setLocation(await useMyPosition());
          } catch (err) {
            toast(`${err.message}. Indique plutôt ta ville.`, { force: true });
          }
        });
      };
      const show = async () => {
        if (!prefs.weather) return form();
        let data;
        try {
          data = await getWeather();
        } catch {
          el.innerHTML = `<div class="wg-title">${svg("cloud")}${prefs.weather.name}</div><div class="wg-sub">Météo indisponible hors ligne.</div>`;
          return;
        }
        const d = describe(data.current.weather_code);
        const days = data.daily.time.slice(1, 4).map((t, i) => {
          const dd = describe(data.daily.weather_code[i + 1]);
          return `<div class="wg-day"><span>${dayName(new Date(t))}</span>${svg(dd.icon)}<span>${Math.round(data.daily.temperature_2m_max[i + 1])}° <em>${Math.round(data.daily.temperature_2m_min[i + 1])}°</em></span></div>`;
        });
        el.innerHTML = `
          <div class="wg-weather">
            <div class="wg-wicon">${svg(d.icon)}</div>
            <div><div class="wg-temp">${Math.round(data.current.temperature_2m)}°</div>
            <div class="wg-sub">${d.label} · ${prefs.weather.name}</div></div>
          </div>
          ${w.size === "l" ? `<div class="wg-days">${days.join("")}</div>` : ""}`;
      };
      show();
      const id = setInterval(show, 30 * 60_000);
      const off = onWeather(show);
      return () => {
        clearInterval(id);
        off();
      };
    },
    menu: [{ label: "Changer de ville", icon: "location", run: askLocation }],
  },

  search: {
    name: "Recherche",
    icon: "search",
    desc: "Recherche Google et Gemini, directement sur le bureau.",
    sizes: { s: [380, 64], l: [560, 64] },
    render(el) {
      el.innerHTML = `
        <form class="wg-search" data-nodrag>
          ${svg("search")}
          <input name="q" placeholder="Rechercher sur Google" aria-label="Rechercher sur Google" autocomplete="off">
          <button type="button" class="icon-btn tonal" title="Demander à Gemini">${svg("sparkle")}</button>
        </form>`;
      const form = el.querySelector("form");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = form.q.value.trim();
        if (!q) return;
        form.q.value = "";
        openUrl("https://www.google.com/search?q=" + encodeURIComponent(q), "la recherche");
      });
      form.querySelector("button").addEventListener("click", async () => {
        const q = form.q.value.trim();
        if (q) {
          await invoke("copy_text", { text: q }).catch(() => navigator.clipboard?.writeText(q));
          toast("Question copiée, colle-la avec Ctrl+V", { icon: "sparkle", force: true, ms: 5000 });
          form.q.value = "";
        }
        launch(byId.get("gemini"));
      });
    },
  },

  note: {
    name: "Pense-bête",
    icon: "note",
    desc: "Une note rapide, gardée sur cet ordinateur.",
    sizes: { s: [240, 220], l: [340, 320] },
    render(el, w) {
      el.innerHTML = `<textarea class="wg-note" data-nodrag placeholder="Pense-bête…" aria-label="Pense-bête"></textarea>`;
      const ta = el.querySelector("textarea");
      ta.value = w.data?.text ?? "";
      let t = 0;
      ta.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          w.data = { ...(w.data ?? {}), text: ta.value };
          save();
        }, 300);
      });
    },
  },
};
