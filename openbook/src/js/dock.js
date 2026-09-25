// 2. Dock centré en bas : bouton lanceur « O » puis applis épinglées.
import { byId } from "./apps.js";
import { appIcon, launch, onRecentChange, recent } from "./launch.js";
import { prefs, save } from "./store.js";
import { showMenu } from "./ui.js";
import { onWindowsApps } from "./winapps.js";

const list = document.querySelector("#dock-apps");

export function isPinned(id) {
  return prefs.pinned.includes(id);
}

export function pin(id) {
  if (isPinned(id)) return;
  prefs.pinned.push(id);
  save();
  renderDock();
}

export function unpin(id) {
  prefs.pinned = prefs.pinned.filter((p) => p !== id);
  save();
  renderDock();
}

export function renderDock() {
  list.innerHTML = "";
  for (const id of prefs.pinned) {
    const app = byId.get(id);
    if (!app) continue;
    const b = document.createElement("button");
    b.className = "dock-app press";
    b.setAttribute("role", "listitem");
    b.title = app.name;
    b.setAttribute("aria-label", app.name);
    b.append(appIcon(app, 48));
    const dot = document.createElement("span");
    dot.className = "dock-dot";
    dot.hidden = !recent.has(id);
    b.append(dot);
    b.addEventListener("click", () => launch(app));
    b.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showMenu(e.clientX, e.clientY - 8, [
        { label: "Ouvrir", icon: "open", run: () => launch(app) },
        { label: "Désépingler", icon: "unpin", run: () => unpin(id) },
      ]);
    });
    list.append(b);
  }
}

onRecentChange(renderDock);
onWindowsApps(renderDock);
