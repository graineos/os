// Parcours Playwright 0.3 : fond d'écran personnel, fichiers sur le bureau,
// captures d'écran et dictée dans Quick Insert (npm run demo dans un autre terminal).
import { chromium } from "playwright";

const BASE = process.env.DEMO_URL ?? "http://localhost:4173/demo/index.html";
const IMAGE = new URL("../demo/exemple-fond.jpg", import.meta.url).pathname;
let failures = 0;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.route(/^https:\/\//, (r) => r.abort());
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.addInitScript(() => {
  if (!localStorage.getItem("openbook.prefs.v1"))
    localStorage.setItem("openbook.prefs.v1", JSON.stringify({ welcomed: true, gbVersion: 2, googlebook: { applied: true } }));
});
await p.goto(BASE + "?clean");
await p.waitForTimeout(1500);
const F = () => p.frames().find((fr) => fr.url().includes("/src/index.html"));
const QI = () => p.frames().find((fr) => fr.url().includes("quickinsert.html"));
const calls = () => p.evaluate(() => window.__TAURI_MOCK__.calls.slice());
const last = async () => (await calls()).at(-1) ?? "";
const ok = (c, m) => {
  if (!c) failures++;
  console.log(c ? "OK  " : "FAIL", m);
};
let f = F();

// Réglages rapides façon Pixel : luminosité en tête.
await f.click("#status");
await p.waitForTimeout(400);
const order = await f.evaluate(() => {
  const card = document.querySelector("#qs .qs-card");
  return [...card.children].map((c) => c.id || c.className).slice(1, 3).join(",");
});
ok(order.startsWith("brightness-row"), "luminosité au-dessus des tuiles (Pixel)");

// Fond d'écran personnel.
await f.click("#qs-settings");
await p.waitForTimeout(400);
ok((await f.textContent("#wp-grid")).includes("Ajouter une image"), "vignette « Ajouter une image »");
const before = await f.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary"));
await f.setInputFiles("#wp-file", IMAGE);
await p.waitForTimeout(2500);
const prefs = await f.evaluate(() => JSON.parse(localStorage.getItem("openbook.prefs.v1")));
ok(prefs.wallpaper === "custom" && /^#[0-9a-f]{6}$/.test(prefs.customSeed), `image importée, couleur source ${prefs.customSeed}`);
const after = await f.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary"));
ok(before !== after, `couleurs Material You tirées de l'image (${before.trim()} → ${after.trim()})`);
ok((await f.textContent("#wp-grid")).includes("Ton image"), "vignette « Ton image »");
ok((await calls()).some((c) => c.startsWith("googlebook_apply") && c.includes("fond d'écran")), "Windows reçoit le nouveau fond");
await f.click("#settings-close");
await p.reload();
await p.waitForTimeout(2000);
f = F();
ok(await f.evaluate(() => document.documentElement.classList.contains("photo")), "image conservée après redémarrage");
const px = await f.evaluate(() => {
  const c = document.querySelector("#wallpaper");
  const d = c.getContext("2d").getImageData(Math.round(c.width * 0.72), Math.round(c.height * 0.25), 1, 1).data;
  return [...d.slice(0, 3)];
});
ok(px[0] > 200 && px[1] > 180, `l'image est dessinée à l'écran (pixel du soleil ${px.join(",")})`);

// Fichiers sur le bureau.
await p.evaluate(() => window.__TAURI_MOCK__.simulate("win"));
await p.waitForTimeout(500);
await f.fill("#search-input", "budget");
await p.waitForTimeout(300);
await f.click('.res-row:has-text("Budget vacances")', { button: "right" });
await f.click('#menu .menu-item:has-text("Ajouter au bureau")');
await f.press("body", "Escape");
await p.waitForTimeout(400);
ok(await f.isVisible('.shortcut[title="Budget vacances.xlsx"]'), "fichier posé sur le bureau");
await f.click('.shortcut[title="Budget vacances.xlsx"]');
await p.waitForTimeout(200);
ok((await last()).includes("open_file") && (await last()).includes("Budget vacances.xlsx"), "clic → ouvre le fichier");
await p.evaluate(() => window.__TAURI_MOCK__.simulate("win"));
await p.waitForTimeout(500);
await f.fill("#search-input", "projet");
await p.waitForTimeout(300);
await f.click('.res-row:has-text("Projet OpenDoor")', { button: "right" });
await f.click('#menu .menu-item:has-text("Ajouter au bureau")');
await f.press("body", "Escape");
await p.waitForTimeout(400);
ok(await f.isVisible('.shortcut[title="Projet OpenDoor"] .app-chip.glyph'), "dossier posé sur le bureau (icône dossier)");

// Quick Insert : captures et dictée.
await p.evaluate(() => window.__TAURI_MOCK__.simulate("caps"));
await p.waitForTimeout(700);
const q = QI();
ok((await q.$$eval(".qi-shot", (e) => e.length)) === 3, "3 captures d'écran récentes");
await q.click(".qi-shot >> nth=1");
await p.waitForTimeout(200);
ok((await last()).includes("qi_insert_image") && (await last()).includes("Capture d'écran 2"), "capture collée dans l'appli active");
await p.evaluate(() => window.__TAURI_MOCK__.simulate("caps"));
await p.waitForTimeout(500);
await q.click("#qi-dictate");
await p.waitForTimeout(200);
ok((await last()).includes("qi_dictate"), "Dicter → saisie vocale Windows");
console.log("erreurs JS:", errs);
await b.close();
if (failures || errs.length) process.exit(1);
