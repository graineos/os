/**
 * Ruches Search — robot d'indexation et construction de l'index statique.
 *
 *   bun ruches/search/crawl.ts <dossier de sortie>          (ex. public/ruches-index)
 *
 * Règles : robots.txt respecté (Allow/Disallow, jokers, Crawl-delay), une requête à la fois par site
 * avec un délai minimal, pages « noindex » écartées, adresse canonique retenue, doublons de contenu
 * écartés, liste d'exclusion (search/exclusions.txt) appliquée. Seules les pages en français sont gardées.
 * Le résultat : index inversé + fiches de pages, en fichiers JSON statiques (voir src/core/websearch.ts).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Parser } from "htmlparser2";
import { DOCS_PER_SHARD, encodePostings, INDEX_VERSION, shardOf, terms, type DocRecord, type IndexManifest } from "../src/core/websearch";

type SiteConfig = { host: string; label: string; max: number; include?: string; seeds?: string[]; noSitemap?: boolean };
const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, "sites.json"), "utf8")) as { userAgent: string; delayMs: number; sites: SiteConfig[] };
const exclusions = readFileSync(join(here, "exclusions.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const out = process.argv[2] ?? join(here, "../../public/ruches-index");
const only = process.argv[3]?.split(",");
const MAX_BYTES = 3_000_000;
const BODY_TOKENS = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...args: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...args);

// ——— robots.txt ———

type Rule = { allow: boolean; pattern: string };
type Robots = { rules: Rule[]; delay: number; sitemaps: string[] };

function parseRobots(text: string, agent = "ruchesbot"): Robots {
  const groups: { agents: string[]; rules: Rule[]; delay: number }[] = [];
  const sitemaps: string[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap") { sitemaps.push(value); continue; }
    if (key === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [], delay: 0 }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") { if (value || key === "allow") current.rules.push({ allow: key === "allow", pattern: value }); }
    else if (key === "crawl-delay") current.delay = Number(value) || 0;
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  return { rules: mine?.rules ?? [], delay: mine?.delay ?? 0, sitemaps };
}

function allowed(robots: Robots, path: string) {
  let best: Rule | null = null;
  for (const rule of robots.rules) {
    if (!rule.pattern) continue;
    const re = new RegExp(`^${rule.pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`);
    if (re.test(path) && (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow))) best = rule;
  }
  return best ? best.allow : true;
}

// ——— Réseau ———

async function get(url: string, accept = "text/html,application/xhtml+xml") {
  try {
    const res = await fetch(url, { headers: { "User-Agent": config.userAgent, Accept: accept, "Accept-Language": "fr-FR,fr;q=0.9" }, signal: AbortSignal.timeout(20_000), redirect: "follow" });
    if (!res.ok) return { status: res.status, url: res.url, type: "", body: "" };
    const type = res.headers.get("content-type") ?? "";
    const buf = await res.arrayBuffer();
    return { status: res.status, url: res.url, type, body: new TextDecoder().decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf) };
  } catch (error) {
    return { status: 0, url, type: "", body: "", error: String(error) };
  }
}

// ——— Extraction ———

const SKIP = new Set(["script", "style", "noscript", "svg", "template", "nav", "header", "footer", "aside", "form", "iframe", "button", "select", "dialog"]);
const BLOCK = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "br", "tr", "td", "th", "section", "article", "blockquote", "dd", "dt", "figcaption", "pre"]);

type Page = { title: string; description: string; text: string; links: string[]; canonical?: string; lang: string; noindex: boolean; nofollow: boolean };

function extract(html: string, base: string): Page {
  const page: Page = { title: "", description: "", text: "", links: [], lang: "", noindex: false, nofollow: false };
  const all: string[] = [];
  const main: string[] = [];
  const stack: { skip: boolean; main: boolean; title: boolean }[] = [];
  const top = () => stack[stack.length - 1] ?? { skip: false, main: false, title: false };
  const parser = new Parser({
    onopentag(name, attrs) {
      const parent = top();
      const isMain = name === "main" || name === "article" || (attrs.role ?? "") === "main" || attrs.id === "mw-content-text";
      stack.push({ skip: parent.skip || SKIP.has(name) || attrs.hidden !== undefined || (attrs.class ?? "").includes("mw-editsection") || (attrs.class ?? "").includes("reference"), main: parent.main || isMain, title: name === "title" });
      if (name === "html" && attrs.lang) page.lang = attrs.lang.toLowerCase();
      if (name === "meta") {
        const key = (attrs.name ?? attrs.property ?? "").toLowerCase();
        if (key === "description" || (key === "og:description" && !page.description)) page.description = attrs.content ?? page.description;
        if (key === "robots" || key === "ruchesbot") {
          const v = (attrs.content ?? "").toLowerCase();
          if (v.includes("noindex") || v.includes("none")) page.noindex = true;
          if (v.includes("nofollow") || v.includes("none")) page.nofollow = true;
        }
      }
      if (name === "link" && (attrs.rel ?? "").toLowerCase() === "canonical" && attrs.href) page.canonical = attrs.href;
      if (name === "a" && attrs.href && !(attrs.rel ?? "").includes("nofollow")) page.links.push(attrs.href);
      if (BLOCK.has(name)) { all.push("\n"); if (top().main) main.push("\n"); }
    },
    ontext(text) {
      const t = top();
      if (t.title) { page.title += text; return; }
      if (t.skip) return;
      all.push(text);
      if (t.main) main.push(text);
    },
    onclosetag(name) {
      stack.pop();
      if (BLOCK.has(name)) { all.push("\n"); if (top().main) main.push("\n"); }
    },
  }, { decodeEntities: true, lowerCaseTags: true });
  parser.write(html);
  parser.end();
  const clean = (parts: string[]) => parts.join(" ").replace(/[ \t\u00a0]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim();
  const mainText = clean(main);
  page.text = mainText.length > 400 ? mainText : clean(all);
  page.title = page.title.replace(/\s+/g, " ").trim();
  page.description = page.description.replace(/\s+/g, " ").trim();
  page.links = page.links.map((href) => { try { return new URL(href, base).href.replace(/#.*$/, ""); } catch { return ""; } }).filter(Boolean);
  return page;
}

function snippetOf(page: Page) {
  if (page.description.length >= 60) return page.description.slice(0, 300);
  const text = page.text.replace(/\s+/g, " ");
  const cut = text.slice(0, 280);
  return text.length > 280 ? `${cut.slice(0, cut.lastIndexOf(" "))}…` : cut;
}

// ——— Collecte par site ———

type Collected = { url: string; title: string; snippet: string; text: string; fetched: number };

async function sitemapUrls(robots: Robots, origin: string, include: RegExp | null, limit: number) {
  const queue = robots.sitemaps.length ? [...robots.sitemaps] : [`${origin}/sitemap.xml`];
  const urls: string[] = [];
  let fetched = 0;
  while (queue.length && fetched < 12 && urls.length < limit * 20) {
    const res = await get(queue.shift() as string, "application/xml,text/xml");
    fetched++;
    if (!res.body) continue;
    for (const m of res.body.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/g)) {
      const loc = m[1].trim().replace(/&amp;/g, "&");
      if (/\.xml(\.gz)?$/i.test(loc) && res.body.includes("<sitemapindex")) { queue.push(loc); continue; }
      try { const u = new URL(loc); if (u.origin === origin && (!include || include.test(u.pathname))) urls.push(u.href); } catch { /* adresse invalide */ }
    }
    await sleep(config.delayMs);
  }
  // Échantillon régulier : on couvre tout le site plutôt que les premières pages du plan.
  if (urls.length <= limit) return urls;
  const step = urls.length / limit;
  return Array.from({ length: limit }, (_, i) => urls[Math.floor(i * step)]);
}

async function crawlSite(site: SiteConfig): Promise<Collected[]> {
  const origin = `https://${site.host}`;
  const robotsRes = await get(`${origin}/robots.txt`, "text/plain");
  const robots = robotsRes.status === 200 ? parseRobots(robotsRes.body) : { rules: [], delay: 0, sitemaps: [] };
  if (robots.delay > 10) { log(site.host, `Crawl-delay ${robots.delay}s : site ignoré`); return []; }
  const delay = Math.max(config.delayMs, robots.delay * 1000);
  const include = site.include ? new RegExp(site.include) : null;
  const ok = (u: URL) => u.origin === origin && (!include || include.test(u.pathname)) && allowed(robots, u.pathname + u.search) && !exclusions.some((e) => u.href.startsWith(e)) && !/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp[34]|ics|xml|json|csv)$/i.test(u.pathname);
  const seeds = (site.seeds ?? ["/"]).map((s) => new URL(s, origin).href);
  const fromMap = site.noSitemap ? [] : await sitemapUrls(robots, origin, include, site.max);
  const queue = [...new Set([...fromMap, ...seeds])];
  const seen = new Set<string>(queue);
  const pages: Collected[] = [];
  const hashes = new Set<string>();
  let requests = 0;
  const budget = site.max * 3;
  while (queue.length && pages.length < site.max && requests < budget) {
    const href = queue.shift() as string;
    const url = new URL(href);
    if (!ok(url) && !seeds.includes(href)) continue;
    requests++;
    const res = await get(href);
    await sleep(delay);
    if (!res.body || !res.type.includes("html")) continue;
    const page = extract(res.body, res.url);
    if (!page.nofollow) for (const link of page.links) {
      try {
        const u = new URL(link);
        u.hash = "";
        if (!seen.has(u.href) && ok(u) && seen.size < site.max * 40) { seen.add(u.href); queue.push(u.href); }
      } catch { /* lien invalide */ }
    }
    if (page.noindex || (page.lang && !page.lang.startsWith("fr")) || page.text.length < 200) continue;
    let final = res.url;
    if (page.canonical) { try { const c = new URL(page.canonical, res.url); if (c.origin === origin) final = c.href; } catch { /* canonique invalide */ } }
    final = final.replace(/#.*$/, "");
    if (!include || include.test(new URL(final).pathname)) {
      const hash = createHash("sha1").update(page.text.slice(0, 4000)).digest("hex");
      if (hashes.has(hash) || pages.some((p) => p.url === final)) continue;
      hashes.add(hash);
      pages.push({ url: final, title: (page.title || final).slice(0, 180), snippet: snippetOf(page), text: page.text.slice(0, 40_000), fetched: Date.now() });
    }
    if (pages.length % 25 === 0 && pages.length) log(site.host, `${pages.length}/${site.max}`);
  }
  log(site.host, `terminé : ${pages.length} pages (${requests} requêtes)`);
  return pages;
}

// ——— Construction de l'index ———

function build(collected: { site: SiteConfig; pages: Collected[] }[]) {
  const docs: DocRecord[] = [];
  const lengths: number[] = [];
  const postings = new Map<string, [number, number][]>();
  const seenUrl = new Set<string>();
  for (const { pages } of collected) for (const page of pages) {
    if (seenUrl.has(page.url)) continue;
    seenUrl.add(page.url);
    const id = docs.length;
    const titleTerms = terms(page.title);
    const bodyTerms = terms(page.text).slice(0, BODY_TOKENS);
    const tf = new Map<string, number>();
    for (const t of titleTerms) tf.set(t, (tf.get(t) ?? 0) + 3); // le titre compte triple
    for (const t of bodyTerms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [term, n] of tf) { let list = postings.get(term); if (!list) postings.set(term, (list = [])); list.push([id, n]); }
    const length = titleTerms.length * 3 + bodyTerms.length;
    lengths.push(length);
    docs.push([page.url, page.title, page.snippet, length, page.fetched]);
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "t"), { recursive: true });
  mkdirSync(join(out, "d"), { recursive: true });
  const shards = new Map<string, Record<string, string>>();
  for (const [term, list] of postings) {
    const key = shardOf(term);
    if (!/^[a-z0-9_]{2}$/.test(key)) continue;
    let shard = shards.get(key);
    if (!shard) shards.set(key, (shard = {}));
    shard[term] = encodePostings(list);
  }
  for (const [key, shard] of shards) writeFileSync(join(out, "t", `${key}.json`), JSON.stringify(shard));
  for (let i = 0; i * DOCS_PER_SHARD < docs.length; i++) writeFileSync(join(out, "d", `${i}.json`), JSON.stringify(docs.slice(i * DOCS_PER_SHARD, (i + 1) * DOCS_PER_SHARD)));
  const manifest: IndexManifest = {
    v: INDEX_VERSION,
    built: Date.now(),
    docs: docs.length,
    avgLength: Math.round(lengths.reduce((a, b) => a + b, 0) / Math.max(docs.length, 1)),
    sites: collected.map(({ site, pages }) => ({ host: site.host.replace(/^www\./, ""), label: site.label, pages: pages.length })).filter((s) => s.pages),
    shards: [...shards.keys()].sort(),
    lengths: lengths.map((n) => n.toString(36)).join(","),
  };
  writeFileSync(join(out, "index.json"), JSON.stringify(manifest));
  log(`index : ${docs.length} pages, ${postings.size} termes, ${shards.size} morceaux → ${out}`);
}

const sites = config.sites.filter((s) => !only || only.includes(s.host));
log(`collecte de ${sites.length} sites`);
const collected = await Promise.all(sites.map(async (site) => ({ site, pages: await crawlSite(site).catch((e) => { log(site.host, "échec", e); return []; }) })));
build(collected);
