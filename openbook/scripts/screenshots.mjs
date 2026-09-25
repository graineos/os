// Captures Playwright de la démo : 1920×1080 et 1366×768, clair et sombre.
//   npm run demo          (dans un autre terminal)
//   npm run screenshots
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.DEMO_URL ?? "http://localhost:4173/demo/index.html?clean";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const SIZES = [[1920, 1080], [1366, 768]];
const THEMES = ["light", "dark"];

// Scènes : état de l'interface à capturer.
const SCENES = {
  accueil: async () => {},
  tiroir: async (f) => {
    await f.click("#launcher");
    await f.waitForTimeout(700);
  },
  reglages: async (f) => {
    await f.click("#status");
    await f.waitForTimeout(700);
  },
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

// Derrière un proxy d'entreprise (HTTPS_PROXY), Chromium ne sait pas joindre
// Google Fonts ni les favicons : Node les récupère à sa place.
// Lancer alors avec NODE_USE_ENV_PROXY=1.
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
for (const [w, h] of SIZES) {
  for (const theme of THEMES) {
    for (const [name, run] of Object.entries(SCENES)) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme });
      if (process.env.HTTPS_PROXY) await page.route(/^https:\/\//, viaNode);
      await page.goto(BASE);
      const frame = page.frameLocator("#app");
      await frame.locator("#dock-apps .dock-app").first().waitFor();
      const f = page.frames().find((fr) => fr.url().includes("/src/index.html"));
      await f.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(900); // favicons + animation d'arrivée
      await run(f);
      const file = `${OUT}${name}-${theme}-${w}x${h}.png`;
      await page.screenshot({ path: file });
      console.log("✓", file);
      await page.close();
    }
  }
}
await browser.close();
