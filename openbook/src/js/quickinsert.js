// Quick Insert (façon ChromeOS) : Verr. Maj ouvre ce panneau près du curseur
// texte. Emoji, historique du presse-papiers, date et heure, calculs : le choix
// est inséré directement dans l'appli en cours (le Rust colle avec Ctrl+V).
import { calculate, convert, formatNumber } from "./calc.js";
import { EMOJI } from "./emoji.js";
import { hydrateIcons, svg } from "./icons.js";
import { applyTheme } from "./theme.js";
import { hasTauri, invoke, listen } from "./tauri.js";
import { normalize } from "./apps.js";

const $ = (s) => document.querySelector(s);
const input = $("#qi-input");
const body = $("#qi-body");
const RECENT_KEY = "openbook.qi.recent";
let cat = "all";
let clipboard = [];
let shots = [];
let selected = 0;
let busy = false;

applyTheme();
hydrateIcons();

function recentEmoji() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function remember(char) {
  try {
    const list = [char, ...recentEmoji().filter((c) => c !== char)].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* sans mémoire */
  }
}

async function insert(text, { emoji = false } = {}) {
  if (emoji) remember(text);
  busy = true;
  try {
    if (hasTauri) await invoke("qi_insert", { text });
    else await navigator.clipboard?.writeText(text).catch(() => {});
  } finally {
    setTimeout(() => (busy = false), 300);
  }
}

function close() {
  if (busy) return;
  invoke("qi_close").catch(() => {});
}

/* ---------- Contenu ---------- */

const cap = (s) => s[0].toUpperCase() + s.slice(1);

function dateItems() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const f = (opts, d = now) => new Intl.DateTimeFormat("fr-FR", opts).format(d);
  return [
    [f({ day: "2-digit", month: "2-digit", year: "numeric" }), "Date courte"],
    [cap(f({ weekday: "long", day: "numeric", month: "long", year: "numeric" })), "Date complète"],
    [f({ hour: "2-digit", minute: "2-digit" }), "Heure"],
    [`${f({ day: "2-digit", month: "2-digit", year: "numeric" })} ${f({ hour: "2-digit", minute: "2-digit" })}`, "Date et heure"],
    [cap(f({ weekday: "long", day: "numeric", month: "long" }, tomorrow)), "Demain"],
    [now.toISOString().slice(0, 10), "ISO 8601"],
  ];
}

function row(icon, text, sub, run) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "qi-item qi-row";
  b.innerHTML = `<span class="qi-row-icon">${svg(icon)}</span><span class="qi-row-text"><span class="qi-row-title"></span><span class="qi-row-sub"></span></span>`;
  b.querySelector(".qi-row-title").textContent = text;
  b.querySelector(".qi-row-sub").textContent = sub;
  b.addEventListener("click", run);
  b._run = run;
  return b;
}

function emojiGrid(list) {
  const grid = document.createElement("div");
  grid.className = "qi-emoji";
  for (const e of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "qi-item qi-emo";
    b.textContent = e.char;
    b.title = e.keywords;
    const run = () => insert(e.char, { emoji: true });
    b.addEventListener("click", run);
    b._run = run;
    grid.append(b);
  }
  return grid;
}

function section(title, ...nodes) {
  const s = document.createElement("section");
  s.className = "qi-section";
  const h = document.createElement("h3");
  h.textContent = title;
  s.append(h, ...nodes);
  return s;
}

function render() {
  const raw = input.value.trim();
  const q = normalize(raw);
  body.innerHTML = "";
  const parts = [];

  if (q) {
    const calc = calculate(raw);
    if (calc !== null) {
      const t = formatNumber(calc);
      parts.push(section("Calcul", row("calc", t, `${raw} =`, () => insert(t))));
    }
    const conv = convert(raw);
    if (conv) {
      const t = formatNumber(conv.value, 4);
      parts.push(section("Conversion", row("swap", t, conv.text, () => insert(t))));
    }
  }

  if (cat === "all" || cat === "emoji") {
    let list;
    if (q) {
      const words = q.split(/\s+/);
      list = EMOJI.filter((e) => words.every((w) => normalize(e.keywords).includes(w)));
    } else {
      const recent = recentEmoji();
      const recentItems = recent.map((c) => EMOJI.find((e) => e.char === c) ?? { char: c, keywords: "" });
      list = cat === "emoji" ? EMOJI : [...recentItems, ...EMOJI.filter((e) => !recent.includes(e.char))].slice(0, 16);
    }
    if (list.length) parts.push(section(q ? "Emoji" : recentEmoji().length && cat === "all" ? "Emoji récents et courants" : "Emoji", emojiGrid(list.slice(0, 120))));
  }

  if (cat === "all" || cat === "clipboard") {
    const items = clipboard.filter((c) => !q || normalize(c).includes(q)).slice(0, cat === "clipboard" ? 25 : 3);
    if (items.length) {
      parts.push(
        section(
          "Presse-papiers",
          ...items.map((c) => row("clipboard", c.replace(/\s+/g, " ").slice(0, 90), c.length > 90 ? `${c.length} caractères` : "Texte copié", () => insert(c))),
        ),
      );
    } else if (cat === "clipboard") {
      const p = document.createElement("p");
      p.className = "qi-empty";
      p.textContent = "Rien de copié depuis le démarrage d'OpenBook. L'historique reste sur cet ordinateur, en mémoire.";
      parts.push(p);
    }
  }

  if ((cat === "all" && !q) || cat === "shots") {
    const list = shots.slice(0, cat === "shots" ? 6 : 3);
    if (list.length) {
      const grid = document.createElement("div");
      grid.className = "qi-shots";
      for (const sh of list) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "qi-item qi-shot";
        b.title = sh.name;
        b.innerHTML = `<img alt="" src="${sh.thumb}">`;
        const run = async () => {
          busy = true;
          await invoke("qi_insert_image", { path: sh.path }).catch(() => {});
          setTimeout(() => (busy = false), 300);
        };
        b.addEventListener("click", run);
        b._run = run;
        grid.append(b);
      }
      parts.push(section("Captures d'écran récentes", grid));
    } else if (cat === "shots") {
      const p = document.createElement("p");
      p.className = "qi-empty";
      p.textContent = "Aucune capture pour l'instant. Windows les range dans Images › Captures d'écran (Win+Maj+S puis enregistrer, ou Impr. écran).";
      parts.push(p);
    }
  }

  if (cat === "all" || cat === "date") {
    const wantDate = !q || /date|heure|jour|demain|auj|iso/.test(q);
    if (wantDate || cat === "date") {
      const items = dateItems().slice(0, cat === "date" ? 6 : q ? 6 : 2);
      parts.push(section("Date et heure", ...items.map(([t, sub]) => row("calendar", t, sub, () => insert(t)))));
    }
  }

  if (q && cat === "all") {
    parts.push(
      section(
        "Rechercher",
        row("search", `« ${raw} » dans OpenBook`, "Applis, fichiers, paramètres, web", () => invoke("show_launcher", { query: raw }).catch(() => {})),
        row("sparkle", "Demander à Gemini", "La question est copiée puis Gemini s'ouvre", async () => {
          await invoke("copy_text", { text: raw }).catch(() => {});
          await invoke("qi_close").catch(() => {});
          await invoke("open_app", { url: "https://gemini.google.com/app" }).catch(() => {});
        }),
      ),
    );
  }

  if (!parts.length) {
    const p = document.createElement("p");
    p.className = "qi-empty";
    p.textContent = "Aucun résultat";
    parts.push(p);
  }
  body.append(...parts);
  select(0);
}

function items() {
  return [...body.querySelectorAll(".qi-item")];
}

function select(i) {
  const all = items();
  if (!all.length) return;
  selected = (i + all.length) % all.length;
  all.forEach((el, k) => el.setAttribute("aria-selected", String(k === selected)));
  all[selected].scrollIntoView({ block: "nearest" });
}

/** Déplacement 2D dans la grille d'emoji, linéaire ailleurs. */
function move(dir) {
  const all = items();
  const cur = all[selected];
  if (cur?.matches(".qi-emo, .qi-shot") && (dir === "up" || dir === "down")) {
    const grid = cur.parentElement;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const idx = [...grid.children].indexOf(cur);
    const target = grid.children[idx + (dir === "down" ? cols : -cols)];
    if (target) return select(all.indexOf(target));
  }
  select(selected + (dir === "down" || dir === "right" ? 1 : -1));
}

async function open() {
  applyTheme();
  busy = false;
  cat = "all";
  document.querySelectorAll(".qi-cat").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cat === "all")));
  input.value = "";
  try {
    clipboard = hasTauri ? (await invoke("qi_history")) ?? [] : clipboard;
  } catch {
    clipboard = [];
  }
  render();
  // Les miniatures des captures arrivent ensuite (décodage côté Rust).
  invoke("qi_screenshots")
    .then((list) => {
      shots = list ?? [];
      if (!input.value) render();
    })
    .catch(() => {});
  $("#qi").classList.remove("show");
  requestAnimationFrame(() => $("#qi").classList.add("show"));
  setTimeout(() => input.focus(), 30);
}

input.addEventListener("input", render);
$("#qi-form").addEventListener("submit", (e) => {
  e.preventDefault();
  items()[selected]?._run?.();
});
addEventListener("keydown", (e) => {
  const map = { ArrowDown: "down", ArrowUp: "up", ArrowRight: "right", ArrowLeft: "left" };
  if (e.key === "Escape") return close();
  if (map[e.key]) {
    const inEmoji = items()[selected]?.matches(".qi-emo, .qi-shot");
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !inEmoji) return;
    e.preventDefault();
    move(map[e.key]);
  }
});
document.querySelectorAll(".qi-cat").forEach((b) =>
  b.addEventListener("click", () => {
    cat = b.dataset.cat;
    document.querySelectorAll(".qi-cat").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    render();
    input.focus();
  }),
);
$("#qi-dictate").addEventListener("click", () => {
  busy = true;
  invoke("qi_dictate").catch(() => {});
  setTimeout(() => (busy = false), 400);
});
addEventListener("blur", () => setTimeout(() => !document.hasFocus() && close(), 150));
listen("qi-open", open);

// Démo navigateur : exemple de presse-papiers.
if (!window.__TAURI__) clipboard = ["Rendez-vous jeudi 14 h au bureau", "https://angel-beta.fr/opendoor", "06 12 34 56 78"];
