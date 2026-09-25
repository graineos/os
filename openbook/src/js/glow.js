// 6. Glowbar : fine barre lumineuse en haut de l'écran (fenêtre transparente,
// toujours au premier plan, que les clics traversent). Elle balaie l'écran au
// démarrage, pulse quand la bulle Gemini est ouverte et montre le niveau de
// batterie pendant 2 secondes quand on branche le chargeur.
import { listen } from "./tauri.js";

const bar = document.querySelector("#bar");
let batteryTimer = 0;

function reset() {
  bar.className = "bar";
  bar.style.transform = "";
  void bar.offsetWidth; // relance les animations CSS
}

export function sweep() {
  reset();
  bar.classList.add("sweep");
}

function pulse(on) {
  reset();
  if (on) bar.classList.add("pulse");
}

function battery(level) {
  clearTimeout(batteryTimer);
  reset();
  bar.style.transform = "scaleX(0)";
  bar.classList.add("battery");
  requestAnimationFrame(() => (bar.style.transform = `scaleX(${Math.max(0.03, level)})`));
  batteryTimer = setTimeout(() => bar.classList.add("fade"), 2000);
}

listen("glow", (mode) => {
  if (mode === "sweep") sweep();
  else if (mode === "pulse-on") pulse(true);
  else if (mode === "pulse-off") pulse(false);
});

navigator.getBattery?.().then((b) => {
  b.addEventListener("chargingchange", () => b.charging && battery(b.level));
});

// Démo navigateur : simulation du branchement du chargeur.
bar.addEventListener("demo-battery", (e) => battery(e.detail));

addEventListener("load", () => setTimeout(sweep, 300));
