// Parcours Playwright de la démo (npm run demo dans un autre terminal).
import { chromium } from "playwright";

const BASE = process.env.DEMO_URL ?? "http://localhost:4173/demo/index.html";
let failures = 0;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
const p = await ctx.newPage();
await p.route(/^https:\/\//, r => r.abort());
const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem("x")) { sessionStorage.setItem("x","1"); localStorage.clear(); } });
await p.goto(BASE + "?clean");
await p.waitForTimeout(1500);
const F = () => p.frames().find(fr => fr.url().includes("/src/index.html"));
const calls = () => p.evaluate(() => window.__TAURI_MOCK__.calls.slice());
const last = async () => (await calls()).at(-1) ?? "";
const ok = (c, m) => {
  if (!c) failures++;
  console.log(c ? "OK  " : "FAIL", m);
};
let f = F();

// bienvenue → transformer
ok(await f.isVisible("#welcome"), "écran de bienvenue au 1er lancement");
await f.click("#welcome-go"); await p.waitForTimeout(600);
const ap = (await calls()).find(c => c.startsWith("googlebook_apply")) ?? "";
ok(ap.includes("thème") && ap.includes("accent #") && ap.includes("fond d'écran") && ap.includes("barre des tâches masquée"), "Transformer Windows → googlebook_apply complet : " + ap.slice(0, 90));
ok((await calls()).some(c => c.startsWith("set_features")), "set_features envoyé au démarrage");
// widgets par défaut
ok((await f.$$eval(".widget", e => e.map(x => x.className))).length === 3, "3 widgets par défaut");
// ajouter un widget via clic droit bureau
await f.click("#desktop", { button: "right", position: { x: 700, y: 500 } });
await f.click('#menu .menu-item:has-text("Ajouter un widget")'); await p.waitForTimeout(300);
ok(await f.isVisible("#widget-picker"), "sélecteur de widgets");
await f.click('.picker-item:has-text("Pense-bête")'); await p.waitForTimeout(300);
ok(await f.isVisible(".widget-note"), "pense-bête ajouté");
await f.fill(".wg-note", "Appeler maman"); await p.waitForTimeout(500);
// glisser le widget
const box = await f.locator(".widget-note").boundingBox();
await p.mouse.move(box.x + 20, box.y + box.height - 10);
await p.mouse.down(); await p.mouse.move(box.x + 220, box.y + box.height + 40, { steps: 8 }); await p.mouse.up();
const box2 = await f.locator(".widget-note").boundingBox();
ok(Math.abs(box2.x - box.x - 200) < 12, "widget déplacé par glisser-déposer");
// agrandir
await f.hover(".widget-note"); await f.click('.widget-note [data-act="size"]'); await p.waitForTimeout(600);
ok((await f.getAttribute(".widget-note", "class")).includes("size-l"), "widget agrandi");
const boxL = await f.locator(".widget-note").boundingBox();
// appui long → menu
await p.mouse.move(1150, 560); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
ok(await f.isVisible("#menu"), "appui long sur le bureau → menu");
await f.press("body", "Escape");
// persistance
await p.reload(); await p.waitForTimeout(1500); f = F();
ok((await f.inputValue(".wg-note")) === "Appeler maman", "pense-bête mémorisé");
const box3 = await f.locator(".widget-note").boundingBox();
ok(Math.abs(box3.x - boxL.x) < 4 && Math.abs(box3.y - boxL.y) < 4 && (await f.getAttribute(".widget-note", "class")).includes("size-l"), "position et taille mémorisées");
ok(!(await f.isVisible("#welcome")), "pas de bienvenue au 2e lancement");
// supprimer widget
await f.hover(".widget-note"); await f.click('.widget-note [data-act="del"]'); await p.waitForTimeout(400);
ok(!(await f.isVisible(".widget-note")), "widget supprimé");
// raccourci bureau depuis tiroir (appli Windows)
await f.click("#launcher"); await p.waitForTimeout(400);
ok((await f.$$eval('.grid-app[data-id^="win:"]', e => e.length)) === 12, "12 applis Windows dans le tiroir");
await f.fill("#search-input", "spot");
ok((await f.textContent(".res-row .res-title")) === "Spotify", "recherche trouve Spotify");
await f.click('.res-row:has-text("Spotify")', { button: "right" });
await f.click('#menu .menu-item:has-text("Ajouter au bureau")'); await p.waitForTimeout(300);
await f.press("body", "Escape"); await p.waitForTimeout(400);
ok(await f.isVisible('.shortcut[title="Spotify"]'), "raccourci Spotify sur le bureau");
await f.click('.shortcut[title="Spotify"]'); await p.waitForTimeout(200);
ok((await last()).includes("launch_windows_app") && (await last()).includes("Spotify.lnk"), "clic raccourci → launch_windows_app");
// épingler appli Windows
await f.click("#launcher"); await p.waitForTimeout(300);
await f.click('.grid-app[title="Paint"]', { button: "right" });
await f.click('#menu .menu-item:has-text("Épingler au dock")');
await f.press("body", "Escape");
ok((await f.$$eval("#dock-apps .dock-app", e => e.map(x => x.title))).includes("Paint"), "Paint épinglé au dock");
// Paramètres Windows
await f.click("#launcher"); await p.waitForTimeout(300);
await f.click('.grid-app[data-id="winsettings"]'); await p.waitForTimeout(200);
ok((await last()) === "open_settings → home", "Paramètres Windows → ms-settings:");
// fenêtres ouvertes
ok((await f.$$eval("#dock-running .dock-app", e => e.length)) === 2, "2 applis non épinglées ouvertes dans le dock");
await f.click('#dock-running .dock-app[title="Spotify"]'); await p.waitForTimeout(1700);
ok((await calls()).some(c => c.includes("focus_window → 105")), "clic → focus_window");
ok((await f.getAttribute('#dock-running .dock-app[title="Spotify"]', "class")).includes("active"), "fenêtre active soulignée");
await f.click('#dock-running .dock-app >> nth=1', { button: "right" });
await f.click('#menu .menu-item:has-text("Fermer la fenêtre")'); await p.waitForTimeout(1900);
ok((await f.$$eval("#dock-running .dock-app", e => e.length)) === 1, "fermer la fenêtre → retirée du dock");
// Touche Windows
await p.evaluate(() => window.__TAURI_MOCK__.simulate("win")); await p.waitForTimeout(400);
ok(await f.isVisible("#drawer") && (await f.evaluate(() => document.activeElement.id)) === "search-input", "touche Windows → lanceur ouvert");
await f.press("body", "Escape"); await p.waitForTimeout(400);
// Réglages rapides : volume, luminosité, tuiles
await f.click("#status"); await p.waitForTimeout(500);
ok(!(await f.isDisabled("#brightness")), "luminosité active (écran intégré)");
await f.fill("#brightness", "40"); await p.waitForTimeout(400);
ok((await calls()).some(c => c === "set_brightness → 40 %"), "set_brightness 40");
await f.fill("#volume", "80"); await p.waitForTimeout(200);
ok((await calls()).some(c => c.includes('"level":80')), "volume 80 %");
await f.click('[data-radio="bluetooth"] [data-settings="bluetooth"]'); await p.waitForTimeout(200);
ok((await last()) === "open_settings → bluetooth", "chevron Bluetooth → Paramètres");
// Paramètres : changer fond → sync windows
await f.click("#status"); await p.waitForTimeout(400);
await f.click("#qs-settings"); await p.waitForTimeout(400);
ok(await f.isVisible("#settings"), "Paramètres OpenBook ouverts");
const n = (await calls()).filter(c => c.startsWith("googlebook_apply")).length;
await f.click('.wp-item[title="Forêt"]'); await p.waitForTimeout(1600);
ok((await calls()).filter(c => c.startsWith("googlebook_apply")).length === n + 1, "changer de fond → Windows suit");
await f.click('#theme-mode [data-mode="dark"]'); await p.waitForTimeout(1600);
ok((await f.getAttribute("html", "data-theme")) === "dark" && (await last()).includes("thème sombre"), "thème sombre → Windows sombre");
// fonctions
await f.click('#feature-options .set-row:has-text("Magic Pointer") input');
ok((await last()).includes('"magicPointer":false'), "désactiver Magic Pointer");
// revenir à Windows
await f.click("#gb-restore"); await p.waitForTimeout(300);
ok((await calls()).some(c => c.startsWith("googlebook_restore")), "Revenir à Windows → restore");
ok(!(await f.isVisible("#gb-restore")) && (await f.textContent("#gb-status")).includes("Désactivé"), "état désactivé affiché");
await f.click("#settings-close");
// bulle gemini
await p.evaluate(() => window.__TAURI_MOCK__.simulate("shake")); await p.waitForTimeout(400);
const bub = p.frames().find(fr => fr.url().includes("bubble.html"));
ok(await p.isVisible("#bubble"), "secousse → bulle Gemini");
ok((await bub.evaluate(() => document.activeElement.id)) === "bubble-input", "focus dans la bulle");
const glowCls = await p.frames().find(fr => fr.url().includes("glow.html")).getAttribute("#bar", "class");
ok(glowCls.includes("pulse"), "Glowbar pulse pendant la bulle");
await bub.fill("#bubble-input", "Bonjour Gemini");
await bub.press("#bubble-input", "Enter"); await p.waitForTimeout(300);
const cs = await calls();
ok(cs.some(c => c === "copy_text → « Bonjour Gemini »") && cs.some(c => c.includes("gemini.google.com")), "bulle → copie + ouvre Gemini");
ok((await bub.textContent("#bubble-done")).includes("Question copiée"), "message « Question copiée »");
await p.waitForTimeout(2600);
ok(await p.isHidden("#bubble"), "bulle refermée");
ok(!(await p.frames().find(fr => fr.url().includes("glow.html")).getAttribute("#bar", "class")).includes("pulse"), "Glowbar arrête de pulser");
// batterie
await p.evaluate(() => window.__TAURI_MOCK__.simulate("charge")); await p.waitForTimeout(900);
const g = p.frames().find(fr => fr.url().includes("glow.html"));
ok((await g.getAttribute("#bar", "style")).includes("scaleX(0.64)"), "Glowbar montre 64 % de batterie");
await p.waitForTimeout(2300);
ok((await g.getAttribute("#bar", "class")).includes("fade"), "puis s'efface après 2 s");
console.log("erreurs JS:", errs);
await b.close();

if (failures || errs.length) process.exit(1);
