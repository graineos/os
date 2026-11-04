/**
 * Ruches — moteurs de recherche et raccourcis « ! » (bangs).
 * Tout est calculé sur l'appareil : on fabrique seulement l'adresse à ouvrir, rien n'est envoyé ailleurs.
 *
 * « !w chat » ouvre Wikipédia, « !sp carte grise » Service-Public, etc. Le signe « & » (habitude Qwant)
 * fonctionne aussi. « ? requête » force la recherche dans Ruches (tes contenus + index Ruches Search).
 */
export type EngineId = "ruches" | "qwant" | "lilo";
export type SearchKind = "all" | "news" | "images" | "videos" | "maps";

export const ENGINES: { id: EngineId; label: string; note: string }[] = [
  { id: "qwant", label: "Qwant", note: "Moteur français, sans pistage publicitaire." },
  { id: "lilo", label: "Lilo", note: "Moteur français solidaire : tes recherches financent des projets." },
  { id: "ruches", label: "Ruches", note: "Notre index et tes contenus, classés sur ton appareil. Rien ne sort." },
];

export const SEARCH_KINDS: { id: SearchKind; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "news", label: "Actualités" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Vidéos" },
  { id: "maps", label: "Cartes" },
];

const enc = encodeURIComponent;

/** Adresse de recherche externe pour un moteur et un type. Lilo couvre Tous et Images ; le reste passe par Qwant. */
export function engineUrl(engine: Exclude<EngineId, "ruches">, q: string, kind: SearchKind = "all"): string {
  if (kind === "maps") return `https://cartes.gouv.fr/?q=${enc(q)}`;
  if (engine === "lilo" && (kind === "all" || kind === "images")) {
    return kind === "images" ? `https://search.lilo.org/?q=${enc(q)}&tab=images` : `https://search.lilo.org/?q=${enc(q)}`;
  }
  return `https://www.qwant.com/?l=fr&t=${kind === "all" ? "web" : kind}&q=${enc(q)}`;
}

export type Bang = { keys: string[]; label: string; url: (q: string) => string; home: string };

/** Raccourcis : services français et publics en priorité. */
export const BANGS: Bang[] = [
  { keys: ["w", "wiki", "wp"], label: "Wikipédia", url: (q) => `https://fr.wikipedia.org/w/index.php?search=${enc(q)}`, home: "https://fr.wikipedia.org/" },
  { keys: ["wt", "dico", "wiktionnaire"], label: "Wiktionnaire", url: (q) => `https://fr.wiktionary.org/w/index.php?search=${enc(q)}`, home: "https://fr.wiktionary.org/" },
  { keys: ["sp", "servicepublic"], label: "Service-Public", url: (q) => `https://www.service-public.gouv.fr/particuliers/recherche?keyword=${enc(q)}`, home: "https://www.service-public.gouv.fr/" },
  { keys: ["lf", "legifrance", "loi"], label: "Légifrance", url: (q) => `https://www.legifrance.gouv.fr/search/all?query=${enc(q)}`, home: "https://www.legifrance.gouv.fr/" },
  { keys: ["insee"], label: "Insee", url: (q) => `https://www.insee.fr/fr/recherche?q=${enc(q)}`, home: "https://www.insee.fr/" },
  { keys: ["vp", "viepublique"], label: "Vie-publique", url: (q) => `https://www.vie-publique.fr/recherche?search_api_fulltext=${enc(q)}`, home: "https://www.vie-publique.fr/" },
  { keys: ["an", "assemblee"], label: "Assemblée nationale", url: (q) => `https://www.assemblee-nationale.fr/dyn/rechercher?q=${enc(q)}`, home: "https://www.assemblee-nationale.fr/" },
  { keys: ["carte", "ign", "c"], label: "Cartes IGN", url: (q) => `https://cartes.gouv.fr/?q=${enc(q)}`, home: "https://cartes.gouv.fr/" },
  { keys: ["osm"], label: "OpenStreetMap", url: (q) => `https://www.openstreetmap.org/search?query=${enc(q)}`, home: "https://www.openstreetmap.org/" },
  { keys: ["mappy", "iti"], label: "Mappy", url: (q) => `https://fr.mappy.com/plan#/${enc(q)}`, home: "https://fr.mappy.com/" },
  { keys: ["meteo"], label: "Météo-France", url: (q) => `https://meteofrance.com/recherche/resultats?query=${enc(q)}`, home: "https://meteofrance.com/" },
  { keys: ["trad", "tr", "reverso"], label: "Reverso", url: (q) => `https://www.reverso.net/traduction-texte#sl=fra&tl=eng&text=${enc(q)}`, home: "https://www.reverso.net/traduction-texte" },
  { keys: ["conj"], label: "Conjugaison (Reverso)", url: (q) => `https://conjugueur.reverso.net/conjugaison-francais-verbe-${enc(q.toLowerCase())}.html`, home: "https://conjugueur.reverso.net/" },
  { keys: ["gallica", "bnf"], label: "Gallica (BnF)", url: (q) => `https://gallica.bnf.fr/services/engine/search/sru?operation=searchRetrieve&query=${enc(`gallica all "${q}"`)}`, home: "https://gallica.bnf.fr/" },
  { keys: ["lbc", "leboncoin"], label: "leboncoin", url: (q) => `https://www.leboncoin.fr/recherche?text=${enc(q)}`, home: "https://www.leboncoin.fr/" },
  { keys: ["sncf", "train"], label: "SNCF Connect", url: () => "https://www.sncf-connect.com/", home: "https://www.sncf-connect.com/" },
  { keys: ["allo", "film", "allocine"], label: "AlloCiné", url: (q) => `https://www.allocine.fr/rechercher/?q=${enc(q)}`, home: "https://www.allocine.fr/" },
  { keys: ["dm", "dailymotion"], label: "Dailymotion", url: (q) => `https://www.dailymotion.com/search/${enc(q)}`, home: "https://www.dailymotion.com/fr" },
  { keys: ["yt", "youtube"], label: "YouTube", url: (q) => `https://www.youtube.com/results?search_query=${enc(q)}`, home: "https://www.youtube.com/" },
  { keys: ["deezer", "musique"], label: "Deezer", url: (q) => `https://www.deezer.com/search/${enc(q)}`, home: "https://www.deezer.com/fr/" },
  { keys: ["q", "qwant"], label: "Qwant", url: (q) => engineUrl("qwant", q), home: "https://www.qwant.com/?l=fr" },
  { keys: ["l", "lilo"], label: "Lilo", url: (q) => engineUrl("lilo", q), home: "https://search.lilo.org/" },
  { keys: ["actu", "news"], label: "Actualités (Qwant)", url: (q) => engineUrl("qwant", q, "news"), home: "https://www.qwant.com/?l=fr&t=news" },
  { keys: ["img", "i", "images"], label: "Images (Qwant)", url: (q) => engineUrl("qwant", q, "images"), home: "https://www.qwant.com/?l=fr&t=images" },
  { keys: ["vid", "v", "videos"], label: "Vidéos (Qwant)", url: (q) => engineUrl("qwant", q, "videos"), home: "https://www.qwant.com/?l=fr&t=videos" },
];

const BANG_INDEX = new Map<string, Bang>();
for (const bang of BANGS) for (const key of bang.keys) BANG_INDEX.set(key, bang);

export type ParsedQuery =
  | { kind: "bang"; bang: Bang; key: string; query: string; url: string }
  | { kind: "local"; query: string }
  | { kind: "plain"; query: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Analyse une saisie. Le raccourci peut être au début ou à la fin (« chat !w »).
 * Un raccourci inconnu est traité comme du texte ordinaire (aucune redirection surprise).
 */
export function parseQuery(input: string): ParsedQuery {
  const raw = input.trim();
  if (raw.startsWith("?")) return { kind: "local", query: raw.slice(1).trim() };
  const tokens = raw.split(/\s+/);
  for (const at of [0, tokens.length - 1]) {
    const token = tokens[at] ?? "";
    const match = /^[!&]([\p{L}\p{N}]+)$/u.exec(token);
    if (!match) continue;
    const key = fold(match[1]!);
    const bang = BANG_INDEX.get(key);
    if (!bang) continue;
    const query = tokens.filter((_, i) => i !== at).join(" ").trim();
    return { kind: "bang", bang, key, query, url: query ? bang.url(query) : bang.home };
  }
  return { kind: "plain", query: raw };
}

/** Raccourcis proposés pendant la saisie de « !xx ». */
export function bangHints(input: string, limit = 5): { key: string; bang: Bang }[] {
  const m = /(?:^|\s)[!&]([\p{L}\p{N}]*)$/u.exec(input.trim());
  if (!m) return [];
  const prefix = fold(m[1] ?? "");
  const out: { key: string; bang: Bang }[] = [];
  for (const bang of BANGS) {
    const key = bang.keys.find((k) => k.startsWith(prefix));
    if (key) out.push({ key, bang });
    if (out.length >= limit) break;
  }
  return out;
}

/** Calculs et conversions instantanés (« 12*7 », « 15 % de 80 »), sans service externe. */
export function instantAnswer(input: string): string | null {
  const q = input.trim().replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/");
  const pct = /^(\d+(?:\.\d+)?)\s*%\s*de\s*(\d+(?:\.\d+)?)$/i.exec(q);
  if (pct) return formatNumber((Number(pct[1]) / 100) * Number(pct[2]));
  if (!/^[\d\s+\-*/().^]+$/.test(q) || !/\d\s*[+\-*/^]\s*[\d(]/.test(q)) return null;
  const value = evaluate(q.replace(/\s+/g, ""));
  return value === null ? null : formatNumber(value);
}

function formatNumber(n: number) {
  return Number.isFinite(n) ? n.toLocaleString("fr-FR", { maximumFractionDigits: 10 }) : "∞";
}

/** Petit évaluateur arithmétique (+ - * / ^ et parenthèses), sans eval. */
function evaluate(expr: string): number | null {
  let i = 0;
  const peek = () => expr[i];
  const number = (): number | null => {
    if (peek() === "(") {
      i++;
      const v = add();
      if (peek() !== ")") return null;
      i++;
      return v;
    }
    if (peek() === "-") { i++; const v = number(); return v === null ? null : -v; }
    const m = /^\d+(?:\.\d+)?/.exec(expr.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const power = (): number | null => {
    const base = number();
    if (base === null) return null;
    if (peek() === "^") { i++; const e = power(); return e === null ? null : base ** e; }
    return base;
  };
  const mul = (): number | null => {
    let v = power();
    while (v !== null && (peek() === "*" || peek() === "/")) {
      const op = expr[i++];
      const r = power();
      if (r === null) return null;
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const add = (): number | null => {
    let v = mul();
    while (v !== null && (peek() === "+" || peek() === "-")) {
      const op = expr[i++];
      const r = mul();
      if (r === null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const result = add();
  return i === expr.length ? result : null;
}
