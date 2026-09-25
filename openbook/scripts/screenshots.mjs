// Captures Playwright de la démo : 1920×1080 et 1366×768, clair et sombre.
//   npm run demo          (dans un autre terminal)
//   npm run screenshots
// Derrière un proxy (HTTPS_PROXY) : NODE_USE_ENV_PROXY=1 npm run screenshots
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.DEMO_URL ?? "http://localhost:4173/demo/index.html?clean";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const SIZES = [[1920, 1080], [1366, 768]];
const THEMES = ["light", "dark"];

// Bureau d'exemple : widgets, raccourcis, météo à Paris.
const SAMPLE = (w, h) => ({
  welcomed: true,
  gbVersion: 2,
  weather: { lat: 48.853, lon: 2.349, name: "Paris" },
  pinned: ["gmail", "drive", "docs", "youtube", "gemini", "files"],
  desktop: [
    { id: "keep", x: w - 128, y: 72 },
    { id: "photos", x: w - 128, y: 192 },
    { id: "opendoor", x: w - 128, y: 312 },
  ],
  widgets: [
    { uid: "clock", type: "clock", size: "l", x: 40, y: 72, data: {} },
    { uid: "weather", type: "weather", size: "l", x: 40, y: 296, data: {} },
    { uid: "search", type: "search", size: "l", x: Math.round(w / 2 - 280), y: Math.round(h * 0.3), data: {} },
    { uid: "glance", type: "glance", size: "s", x: Math.round(w / 2 - 150), y: Math.round(h * 0.3) - 136, data: {} },
    { uid: "note", type: "note", size: "s", x: w - 400, y: 72, data: { text: "Courses :\n– pain\n– tomates\n– café" } },
  ],
});

const frameOf = (page) => page.frames().find((fr) => fr.url().includes("/src/index.html"));

// Scènes : état de l'interface à capturer.
const SCENES = {
  accueil: { prefs: SAMPLE, run: async () => {} },
  bienvenue: { prefs: () => ({ welcomed: false }), run: async (f) => f.waitForTimeout(900) },
  tiroir: {
    prefs: SAMPLE,
    run: async (f) => {
      await f.click("#launcher");
      await f.waitForTimeout(700);
    },
  },
  reglages: {
    prefs: SAMPLE,
    run: async (f) => {
      await f.click("#status");
      await f.waitForTimeout(800);
    },
  },
  parametres: {
    prefs: SAMPLE,
    run: async (f) => {
      await f.evaluate(() => document.querySelector("#qs-settings").click());
      await f.waitForTimeout(700);
    },
  },
  "mode-googlebook": {
    prefs: SAMPLE,
    run: async (f) => {
      await f.evaluate(() => document.querySelector("#qs-settings").click());
      await f.waitForTimeout(300);
      await f.evaluate(() => document.querySelector("#set-googlebook").scrollIntoView());
      await f.waitForTimeout(600);
    },
  },
  widgets: {
    prefs: SAMPLE,
    run: async (f, page, [w, h]) => {
      await f.click("#desktop", { button: "right", position: { x: Math.round(w * 0.55), y: Math.round(h * 0.62) } });
      await f.waitForTimeout(250);
      await f.click('#menu .menu-item:has-text("Ajouter un widget")');
      await f.waitForTimeout(700);
    },
  },
  "vue-ensemble": {
    prefs: SAMPLE,
    run: async (f, page) => {
      await page.evaluate(() => window.__TAURI_MOCK__.simulate("wintab"));
      await page.waitForTimeout(700);
    },
  },
  recherche: {
    prefs: SAMPLE,
    run: async (f, page) => {
      await page.evaluate(() => window.__TAURI_MOCK__.simulate("win"));
      await page.waitForTimeout(500);
      await f.fill("#search-input", "rapport");
      await page.waitForTimeout(500);
    },
  },
  "quick-insert": {
    prefs: SAMPLE,
    run: async (f, page) => {
      await page.evaluate(() => window.__TAURI_MOCK__.simulate("caps"));
      await page.waitForTimeout(700);
    },
  },
  gemini: {
    prefs: SAMPLE,
    run: async (f, page) => {
      await page.evaluate(() => window.__TAURI_MOCK__.simulate("shake"));
      await page.waitForTimeout(300);
      await page.frameLocator("#bubble").locator("#bubble-input").fill("Que faire à Paris ce week-end ?");
      await page.waitForTimeout(500);
    },
  },
};

// Derrière un proxy d'entreprise (HTTPS_PROXY), Chromium ne sait pas joindre
// Google Fonts, les favicons ni Open-Meteo : Node les récupère à sa place.
async function viaNode(route) {
  try {
    const res = await fetch(route.request().url());
    const body = Buffer.from(await res.arrayBuffer());
    await route.fulfill({
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "", "access-control-allow-origin": "*" },
      body,
    });
  } catch {
    await route.abort();
  }
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const only = process.argv[2];
for (const [w, h] of SIZES) {
  for (const theme of THEMES) {
    for (const [name, scene] of Object.entries(SCENES)) {
      if (only && name !== only) continue;
      const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme });
      if (process.env.HTTPS_PROXY) await page.route(/^https:\/\//, viaNode);
      const prefs = scene.prefs(w, h);
      await page.addInitScript((p) => {
        try {
          if (!localStorage.getItem("openbook.prefs.v1")) localStorage.setItem("openbook.prefs.v1", JSON.stringify(p));
        } catch {}
      }, prefs);
      await page.goto(BASE);
      await page.frameLocator("#app").locator("#dock-apps .dock-app").first().waitFor();
      const f = frameOf(page);
      await f.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1600); // favicons, météo, balayage de la Glowbar
      await scene.run(f, page, [w, h]);
      const file = `${OUT}${name}-${theme}-${w}x${h}.jpg`;
      await page.screenshot({ path: file, type: "jpeg", quality: 90 });
      console.log("✓", file);
      await page.close();
    }
  }
}
await browser.close();
