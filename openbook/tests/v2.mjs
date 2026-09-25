// Parcours Playwright de la démo (npm run demo dans un autre terminal).
import { chromium } from "playwright";

const BASE = process.env.DEMO_URL ?? "http://localhost:4173/demo/index.html";
let failures = 0;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const p = await ctx.newPage();
await p.route(/^https:\/\//, r => r.abort());
const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.addInitScript(() => { if (!localStorage.getItem("openbook.prefs.v1")) localStorage.setItem("openbook.prefs.v1", JSON.stringify({ welcomed: false })); });
await p.goto(BASE + "?clean");
await p.waitForTimeout(2000);
const F = () => p.frames().find(fr => fr.url().includes("/src/index.html"));
const QI = () => p.frames().find(fr => fr.url().includes("quickinsert.html"));
const calls = () => p.evaluate(() => window.__TAURI_MOCK__.calls.slice());
const last = async () => (await calls()).at(-1) ?? "";
const has = async (s) => (await calls()).some(c => c.includes(s));
const ok = (c, m) => {
  if (!c) failures++;
  console.log(c ? "OK  " : "FAIL", m);
};
const f = F();

// Surcouche totale
await f.click("#welcome-go"); await p.waitForTimeout(500);
ok(await has("barre des tâches masquée"), "Transformer Windows appliqué");
const gb = (await calls()).find(c => c.startsWith("googlebook_apply"));
ok(await p.evaluate(() => true) && gb, "googlebook_apply envoyé");
ok(await has('"windowsKey":true'), "set_features inclut windowsKey");
await p.evaluate(() => window.__TAURI_MOCK__.simulate("win")); await p.waitForTimeout(500);
ok(await f.isVisible("#drawer"), "touche Windows → lanceur");
await p.evaluate(() => window.__TAURI_MOCK__.simulate("win")); await p.waitForTimeout(500);

// Dock fusionné
const titles = await f.$$eval("#dock-apps .dock-app", e => e.map(x => [x.title, x.className]));
const gmail = titles.find(t => t[0] === "Gmail");
ok(gmail && gmail[1].includes("active"), "Gmail épinglé : fenêtre active soulignée");
const files = titles.find(t => t[0].startsWith("Fichiers"));
ok(files && files[1].includes("many") && files[0].includes("2 fenêtres"), "Fichiers : 2 fenêtres regroupées");
ok(titles.find(t => t[0] === "YouTube")?.[1].includes("running"), "YouTube : fenêtre ouverte");
const others = await f.$$eval("#dock-running .dock-app", e => e.map(x => x.title));
ok(others.length === 2 && others.some(t => /spotify/i.test(t)), "applis non épinglées à part (Spotify, Bloc-notes)");
await f.click('#dock-apps .dock-app[title="Gmail"]'); await p.waitForTimeout(300);
ok((await last()).includes("snap_window → 101 min"), "clic sur l'appli active → réduire");
await f.click('#dock-apps .dock-app[title="Gmail"]'); await p.waitForTimeout(300);
ok((await calls()).some(c => c.includes("focus_window → 101")), "re-clic → afficher");
await f.hover('#dock-apps .dock-app[title="YouTube"]'); await p.waitForTimeout(900);
ok(await f.isVisible("#preview .pv-card"), "survol → aperçu");
ok(await has("set_thumbnails → 1 miniature"), "aperçu → miniature DWM demandée");
await f.click('#dock-apps .dock-app[title="YouTube"]', { button: "right" });
await f.click('#menu .menu-item:has-text("Ancrer à gauche")'); await p.waitForTimeout(300);
ok(await has("snap_window → 102 left"), "menu → ancrer à gauche");
await f.click('#dock-apps .dock-app[title^="Fichiers"]'); await p.waitForTimeout(400);
ok((await f.$$eval("#preview .pv-card", e => e.length)) === 2, "Fichiers (2 fenêtres) → choix dans l'aperçu");
await f.click("#preview .pv-card >> nth=1"); await p.waitForTimeout(300);
ok(await has("focus_window → 104"), "choix de la fenêtre → afficher");

// Vue d'ensemble
await p.evaluate(() => window.__TAURI_MOCK__.simulate("wintab")); await p.waitForTimeout(700);
ok((await f.$$eval(".ov-card", e => e.length)) === 6, "Win+Tab → Vue d'ensemble, 6 fenêtres");
ok(await has("set_thumbnails → 6 miniature"), "6 miniatures DWM");
await f.click('.ov-card >> nth=4 >> [data-snap="right"]'); await p.waitForTimeout(400);
ok(await has("snap_window → 105 right"), "Vue d'ensemble → ancrer à droite");
await f.click("#overview-btn"); await p.waitForTimeout(500);
await f.click(".ov-card >> nth=5 >> .ov-thumb"); await p.waitForTimeout(400);
ok(await has("focus_window → 106") && await f.isHidden("#overview"), "clic miniature → fenêtre + fermeture");

// Lanceur
await f.click("#launcher"); await p.waitForTimeout(500);
ok((await f.$$eval("#continue .chip-file", e => e.length)) === 5, "Continuer : 5 fichiers récents");
await f.fill("#search-input", "rapport"); await p.waitForTimeout(300);
ok((await f.textContent("#results")).includes("Rapport annuel 2026.docx"), "recherche fichiers");
await f.press("#search-input", "Enter"); await p.waitForTimeout(300);
ok((await last()).includes("open_file") && (await last()).includes("Rapport annuel"), "Entrée → ouvre le fichier");
await f.click("#launcher"); await p.waitForTimeout(400);
await f.fill("#search-input", "(2+3)*4"); await p.waitForTimeout(200);
ok((await f.textContent("#results .res-row")).includes("= 20"), "calcul (2+3)*4 = 20");
await f.press("#search-input", "Enter"); await p.waitForTimeout(200);
ok((await last()).includes("copy_text → « 20 »"), "Entrée → copie le résultat");
await f.fill("#search-input", "10 km en miles"); await p.waitForTimeout(200);
ok((await f.textContent("#results")).includes("6,2137 miles"), "conversion km → miles");
await f.fill("#search-input", "bluetooth"); await p.waitForTimeout(200);
const rows = await f.$$eval(".res-row .res-title", e => e.map(x => x.textContent));
ok(rows.includes("Bluetooth et appareils"), "recherche → page de Paramètres Windows");
await f.fill("#search-input", "spot"); await p.waitForTimeout(200);
await f.press("#search-input", "ArrowDown"); await f.press("#search-input", "ArrowUp");
await f.press("#search-input", "Enter"); await p.waitForTimeout(200);
ok((await last()).includes("launch_windows_app") && (await last()).includes("Spotify"), "clavier : Entrée lance Spotify");

// Réglages rapides
await f.click("#status"); await p.waitForTimeout(700);
ok((await f.getAttribute('[data-radio="wifi"]', "aria-pressed")) === "true", "Wi-Fi activé (état réel)");
await f.click('[data-radio="bluetooth"] .tile-main'); await p.waitForTimeout(200);
ok(await has("radio_set → bluetooth activé"), "tuile Bluetooth → radio activée");
ok((await f.inputValue("#volume")) === "42", "volume réel lu (42 %)");
await f.fill("#volume", "70"); await p.waitForTimeout(200);
ok(await has('volume_set → {"level":70'), "curseur volume → 70 %");
await f.click("#volume-mute"); await p.waitForTimeout(200);
ok(await has('"muted":true'), "couper le son");
ok((await f.textContent("#media-title")) === "Midnight City", "lecteur : titre en cours");
await f.click('[data-media="toggle"]'); await p.waitForTimeout(600);
ok(await has("media_control → toggle"), "lecture/pause");
await f.click('[data-detail="wifi"]'); await p.waitForTimeout(400);
ok((await f.$$eval(".wifi-row", e => e.length)) === 3, "liste des réseaux Wi-Fi");
await f.click('.wifi-row:has-text("Café du coin")'); await p.waitForTimeout(200);
ok(await has("wifi_connect → Café du coin"), "connexion à un réseau enregistré");
await f.click('.wifi-row:has-text("Freebox-Voisin")'); await p.waitForTimeout(200);
ok((await last()).includes("open_settings → wifi"), "réseau inconnu → Paramètres Wi-Fi");
await f.press("body", "Escape");

// Quick Insert
await p.evaluate(() => window.__TAURI_MOCK__.simulate("caps")); await p.waitForTimeout(600);
const q = QI();
ok((await q.evaluate(() => document.activeElement.id)) === "qi-input", "Verr. Maj → Quick Insert, focus");
await q.fill("#qi-input", "coeur rouge"); await p.waitForTimeout(200);
await q.press("#qi-input", "Enter"); await p.waitForTimeout(200);
ok((await last()).includes("qi_insert → « ❤️ »"), "emoji inséré dans l'appli active");
await p.evaluate(() => window.__TAURI_MOCK__.simulate("caps")); await p.waitForTimeout(500);
await q.fill("#qi-input", "15%*80"); await p.waitForTimeout(200);
await q.press("#qi-input", "Enter"); await p.waitForTimeout(200);
ok((await last()).includes("qi_insert → « 12 »"), "calcul inséré (15 % de 80 = 12)");
await p.evaluate(() => window.__TAURI_MOCK__.simulate("caps")); await p.waitForTimeout(500);
await q.click('.qi-cat[data-cat="clipboard"]');
await q.click('.qi-row:has-text("06 12 34 56 78")'); await p.waitForTimeout(200);
ok((await last()).includes("qi_insert → « 06 12 34 56 78 »"), "presse-papiers inséré");
await p.evaluate(() => window.__TAURI_MOCK__.simulate("caps")); await p.waitForTimeout(500);
await q.fill("#qi-input", "météo lyon"); await p.waitForTimeout(200);
await q.click('.qi-row:has-text("dans OpenBook")'); await p.waitForTimeout(600);
ok(await f.isVisible("#drawer") && (await f.inputValue("#search-input")) === "météo lyon", "Quick Insert → lanceur avec la recherche");
await f.press("body", "Escape");

// Paramètres
await f.click("#status"); await p.waitForTimeout(400);
await f.click("#qs-settings"); await p.waitForTimeout(400);
ok((await f.textContent("#gb-options")).includes("Ouvrir OpenBook au démarrage"), "option démarrage automatique");
await f.click('#feature-options .set-row:has-text("Touche Windows") input');
ok((await last()).includes('"windowsKey":false'), "désactiver la touche Windows");
console.log("erreurs JS:", errs);
await b.close();

if (failures || errs.length) process.exit(1);
