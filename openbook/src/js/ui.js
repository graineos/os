// Briques d'interface partagées : panneaux animés, menu contextuel,
// confirmation, toasts et notifications propres à OpenBook.
import { svg } from "./icons.js";
import { prefs, save } from "./store.js";

const $ = (sel) => document.querySelector(sel);

/* ---------- Panneaux (tiroir, réglages rapides) ---------- */

const openPanels = new Set();

export function openPanel(el, trigger) {
  if (openPanels.has(el)) return;
  el.hidden = false;
  el.getBoundingClientRect(); // force le style initial avant la transition
  el.classList.add("open");
  trigger?.setAttribute("aria-expanded", "true");
  el._trigger = trigger;
  openPanels.add(el);
}

export function closePanel(el) {
  if (!openPanels.has(el)) return;
  openPanels.delete(el);
  el.classList.remove("open");
  el._trigger?.setAttribute("aria-expanded", "false");
  const done = () => {
    if (!el.classList.contains("open")) el.hidden = true;
  };
  el.addEventListener("transitionend", done, { once: true });
  setTimeout(done, 400); // secours si aucune transition (mouvement réduit)
}

export function togglePanel(el, trigger) {
  openPanels.has(el) ? closePanel(el) : openPanel(el, trigger);
}

export function isOpen(el) {
  return openPanels.has(el);
}

export function closeAllPanels() {
  [...openPanels].forEach(closePanel);
  dispatchEvent(new CustomEvent("openbook:close-all"));
}

/* ---------- Menu contextuel ---------- */

const menu = $("#menu");

export function showMenu(x, y, items) {
  menu.innerHTML = "";
  for (const item of items) {
    const b = document.createElement("button");
    b.className = "menu-item";
    b.setAttribute("role", "menuitem");
    b.innerHTML = `<span class="icon">${svg(item.icon)}</span><span>${item.label}</span>`;
    b.addEventListener("click", () => {
      hideMenu();
      item.run();
    });
    menu.append(b);
  }
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth - r.width - 8) + "px";
  menu.style.top = Math.min(y, innerHeight - r.height - 8) + "px";
  menu.classList.add("open");
  menu.querySelector("button")?.focus({ preventScroll: true });
}

export function hideMenu() {
  menu.classList.remove("open");
  menu.hidden = true;
}

export function menuOpen() {
  return !menu.hidden;
}

addEventListener("pointerdown", (e) => {
  if (!menu.hidden && !menu.contains(e.target)) hideMenu();
});
addEventListener("blur", hideMenu);

/* ---------- Confirmation ---------- */

const dlg = $("#confirm");

export function confirmAction({ title, text, ok = "Confirmer", icon = "info", danger = false }) {
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-ok").textContent = ok;
  $("#confirm-ok").classList.toggle("danger", danger);
  $("#confirm-icon").innerHTML = svg(icon);
  dlg.returnValue = "cancel";
  dlg.showModal();
  $("#confirm-ok").focus();
  return new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "ok"), { once: true });
  });
}

dlg.addEventListener("click", (e) => {
  if (e.target === dlg) dlg.close("cancel"); // clic sur le fond
});

/* ---------- Toasts ---------- */

const toasts = $("#toasts");

export function toast(text, { icon = "info", force = false, ms = 3800 } = {}) {
  if (prefs.dnd && !force) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span class="icon">${svg(icon)}</span><span></span>`;
  t.lastChild.textContent = text;
  toasts.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 400);
  }, ms);
}

/* ---------- Notifications ---------- */

const list = $("#notif-list");
const listeners = new Set();

export function onNotificationsChange(fn) {
  listeners.add(fn);
}

export function notify(title, text = "", icon = "bell") {
  prefs.notifications.unshift({ id: Date.now() + Math.random(), title, text, icon, at: Date.now() });
  prefs.notifications = prefs.notifications.slice(0, 30);
  save();
  renderNotifications();
  toast(text ? `${title} — ${text}` : title, { icon });
}

function removeNotification(id) {
  prefs.notifications = prefs.notifications.filter((n) => n.id !== id);
  save();
  renderNotifications();
}

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function renderNotifications() {
  list.innerHTML = "";
  for (const n of prefs.notifications) {
    const li = document.createElement("li");
    li.className = "notif";
    li.innerHTML = `
      <span class="notif-icon icon">${svg(n.icon)}</span>
      <div class="notif-body"><div class="notif-title"></div><div class="notif-text"></div></div>
      <span class="notif-time">${timeFmt.format(n.at)}</span>
      <button class="icon-btn notif-dismiss" title="Ignorer">${svg("close")}</button>`;
    li.querySelector(".notif-title").textContent = n.title;
    li.querySelector(".notif-text").textContent = n.text;
    li.querySelector(".notif-dismiss").addEventListener("click", () => removeNotification(n.id));
    list.append(li);
  }
  $("#notif-empty").hidden = prefs.notifications.length > 0;
  $("#notif-clear").hidden = prefs.notifications.length === 0;
  listeners.forEach((fn) => fn(prefs.notifications.length));
}

$("#notif-clear").addEventListener("click", () => {
  prefs.notifications = [];
  save();
  renderNotifications();
});
