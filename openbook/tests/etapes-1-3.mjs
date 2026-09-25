// Parcours Playwright de la démo (npm run demo dans un autre terminal).
import { chromium } from "playwright";

const BASE = process.env.DEMO_URL ?? "http://localhost:4173/demo/index.html";
let failures = 0;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.addInitScript(() => { if (!localStorage.getItem("openbook.prefs.v1")) localStorage.setItem("openbook.prefs.v1", JSON.stringify({ welcomed: true })); });
await p.goto(BASE + "?clean");
const f = () => p.frames().find(fr => fr.url().includes("/src/index.html"));
await p.waitForTimeout(800);
const F = f();
F.on?.("console", ()=>{});
const calls = () => p.evaluate(() => window.__TAURI_MOCK__.calls.slice());
const ok = (c, m) => {
  if (!c) failures++;
  console.log(c ? "OK  " : "FAIL", m);
};

// tiroir + filtre
await F.click("#launcher"); await p.waitForTimeout(500);
ok(await F.isVisible("#drawer"), "tiroir ouvert");
ok(await F.evaluate(() => document.activeElement.id) === "search-input", "focus recherche");
await F.fill("#search-input", "you");
ok((await F.$$eval('.res-group:has(h3:text("Applis")) .res-row', e => e.length)) === 2, "recherche 'you' → 2 applis");
await F.fill("#search-input", "actualites");
ok((await F.textContent(".res-row .res-title")) === "Actualités", "recherche sans accents");
await F.fill("#search-input", "meteo lyon demain");
await F.press("#search-input", "Enter"); await p.waitForTimeout(500);
ok((await calls()).at(-1).includes("google.com/search?q=meteo"), "Entrée → recherche Google si aucune appli");
ok(!(await F.isVisible("#drawer")), "tiroir fermé après recherche");

// clic droit → épingler
await F.click("#launcher"); await p.waitForTimeout(400);
await F.click('.grid-app[data-id="keep"]', { button: "right" });
ok(await F.isVisible("#menu"), "menu contextuel");
await F.click('#menu .menu-item:has-text("Épingler au dock")');
ok((await F.$$eval(".dock-app", e => e.map(x => x.title))).includes("Keep"), "Keep épinglé");
// Échap ferme
await F.press("body", "Escape"); await p.waitForTimeout(450);
ok(!(await F.isVisible("#drawer")), "Échap ferme le tiroir");
// dock : lancer + point
await F.click('.dock-app[title="Drive"]'); await p.waitForTimeout(200);
ok((await calls()).at(-1).includes("drive.google.com"), "clic dock → open_app Drive (sans fenêtre ouverte)");
ok((await F.getAttribute('.dock-app[title="Gmail"]', "class")).includes("active"), "Gmail : fenêtre active soulignée");
// désépingler
await F.click('.dock-app[title="Keep"]', { button: "right" });
await F.click('#menu .menu-item:has-text("Désépingler")');
ok(!(await F.$$eval(".dock-app", e => e.map(x => x.title))).includes("Keep"), "Keep désépinglé");
// fichiers
await F.click('.dock-app[title^="Fichiers"]', { button: "right" });
await F.click('#menu .menu-item:has-text("Nouvelle fenêtre")'); await p.waitForTimeout(200);
ok((await calls()).at(-1).includes("explorer"), "Fichiers → nouvelle fenêtre explorer.exe");
// réglages rapides
await F.click("#status"); await p.waitForTimeout(500);
ok(await F.isVisible("#qs"), "panneau réglages");
const before = await F.getAttribute("html", "data-theme");
await F.click('[data-tile="dark"]');
ok(before !== await F.getAttribute("html", "data-theme"), "bascule thème");
await F.click('[data-tile="fullscreen"]'); await p.waitForTimeout(200);
ok((await calls()).some(c => c.includes("toujours en dessous = true")), "mode non plein écran → toujours en dessous");
await F.click('[data-tile="fullscreen"]'); await p.waitForTimeout(200);
ok((await calls()).at(-1).includes("plein écran = true"), "retour plein écran");
ok(!(await F.isDisabled("#brightness")), "luminosité réglable (écran intégré simulé)");
// éteindre : annuler puis confirmer
await F.click('[data-power="shutdown"]');
ok(await F.isVisible("#confirm"), "confirmation affichée");
await F.click('#confirm button[value="cancel"]'); await p.waitForTimeout(200);
ok(!(await calls()).some(c => c.includes("shutdown")), "annuler → rien");
await F.click('[data-power="shutdown"]');
await F.click('#confirm-ok'); await p.waitForTimeout(200);
ok((await calls()).at(-1).includes("power → shutdown"), "confirmer → power shutdown");
// persistance
await p.reload(); await p.waitForTimeout(800);
ok((await f().getAttribute("html", "data-theme")) !== before, "thème mémorisé");
// clic extérieur ferme tiroir
const G = f();
await G.click("#launcher"); await p.waitForTimeout(400);
await G.mouse?.click?.(100, 300);
await p.mouse.click(100, 300); await p.waitForTimeout(450);
ok(!(await G.isVisible("#drawer")), "clic extérieur ferme le tiroir");
// gemini
await G.click("#launcher"); await p.waitForTimeout(300);
await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
await G.fill("#search-input", "Quelle heure à Tokyo ?");
await G.click("#ask-gemini"); await p.waitForTimeout(300);
ok((await calls()).at(-1).includes("gemini.google.com"), "Demander à Gemini → open_app");
ok((await G.textContent(".toasts")).includes("Question copiée"), "toast question copiée");
console.log("erreurs JS:", errs);
await b.close();

if (failures || errs.length) process.exit(1);
