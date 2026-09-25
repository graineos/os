// Bulle « Demander à Gemini » du Magic Pointer : fenêtre flottante ouverte par
// le Rust quand on secoue la souris. Valider copie la question dans le
// presse-papiers et ouvre Gemini : la question n'est jamais préremplie.
import { hydrateIcons } from "./icons.js";
import { applyTheme } from "./theme.js";
import { invoke, listen } from "./tauri.js";

const form = document.querySelector("#bubble");
const input = document.querySelector("#bubble-input");
const done = document.querySelector("#bubble-done");
let busy = false;

applyTheme();
hydrateIcons();

function hide() {
  if (busy) return;
  form.classList.remove("show");
  invoke("hide_bubble").catch(() => {});
}

function open() {
  applyTheme();
  busy = false;
  input.value = "";
  input.hidden = false;
  done.hidden = true;
  form.classList.remove("show");
  requestAnimationFrame(() => form.classList.add("show"));
  setTimeout(() => input.focus(), 30);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  busy = true;
  try {
    if (q) {
      await invoke("copy_text", { text: q });
      input.hidden = true;
      done.hidden = false;
    }
    await invoke("open_app", { url: "https://gemini.google.com/app" });
  } catch {
    /* le lancement affiche ses propres erreurs dans OpenBook */
  }
  setTimeout(() => {
    busy = false;
    hide();
  }, q ? 2200 : 0);
});

addEventListener("keydown", (e) => e.key === "Escape" && hide());
addEventListener("blur", () => setTimeout(hide, 120));
listen("bubble-open", open);
