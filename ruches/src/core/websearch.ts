/**
 * Ruches Search — moteur de recherche web sans serveur de recherche.
 *
 * Le robot (search/crawl.ts) construit un index inversé publié en fichiers statiques :
 *   index.json            manifeste (taille, longueur moyenne, sites, date)
 *   t/<préfixe>.json      listes de postings, découpées par les 2 premiers caractères du terme
 *   d/<n>.json            fiches des pages (titre, adresse, extrait, date), par paquets de 100
 * Le navigateur ne télécharge que les morceaux utiles à la requête et calcule lui-même le
 * classement (BM25 + bonus de titre et d'expression exacte). Chaque score est explicable.
 * Ce module est partagé par le robot et par le client : même découpage des mots des deux côtés.
 */

export const INDEX_VERSION = 1;
export const DOCS_PER_SHARD = 100;

export type IndexManifest = {
  v: number;
  built: number;
  docs: number;
  avgLength: number;
  sites: { host: string; label: string; pages: number }[];
  shards: string[];
  /** Longueur (en mots) de chaque page, en base 36, séparées par des virgules : utile au BM25. */
  lengths: string;
};

/** Fiche d'une page : [adresse, titre, extrait, longueur (mots), date de collecte, langue]. */
export type DocRecord = [url: string, title: string, snippet: string, length: number, fetched: number];

/** Postings d'un terme : liste « id:tf » (tf omis s'il vaut 1), id en base 36. Le titre compte triple. */
export type Shard = Record<string, string>;

const STOP = new Set(
  (
    "a au aux avec ce ces cet cette dans de des du elle en et eux il ils je la le les leur leurs lui ma mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous " +
    "c d j l m n s t y est sont ete etre avoir ont fait plus tout tous toute toutes comme si sans sous entre aussi bien peut deux tres ainsi dont ni or donc car " +
    "the of and to in is for on that with as by at from or an be this it are was"
  ).split(" "),
);

export function foldText(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Racinisation légère et prévisible (pluriels, quelques terminaisons) : « impôts » = « impot ». */
export function stem(word: string) {
  if (word.length <= 3 || /^\d+$/.test(word)) return word;
  let w = word;
  if (w.length > 5 && w.endsWith("ements")) w = w.slice(0, -1);
  if (w.endsWith("aux") && w.length > 4) w = `${w.slice(0, -3)}al`;
  else if ((w.endsWith("s") || w.endsWith("x")) && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Découpe un texte en termes indexables (accents retirés, mots vides ignorés). */
export function terms(text: string): string[] {
  const out: string[] = [];
  for (const raw of foldText(text).split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || raw.length > 40 || STOP.has(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

export const shardOf = (term: string) => term.slice(0, 2).padEnd(2, "_");

export function encodePostings(list: [number, number][]) {
  return list.map(([id, tf]) => (tf > 1 ? `${id.toString(36)}:${tf}` : id.toString(36))).join(",");
}

export function decodePostings(value: string): [number, number][] {
  if (!value) return [];
  return value.split(",").map((p) => {
    const [id, tf] = p.split(":");
    return [parseInt(id, 36), tf ? Number(tf) : 1];
  });
}

export type Explain = { term: string; tf: number; df: number; idf: number; score: number };
export type WebResult = {
  id: number;
  url: string;
  host: string;
  title: string;
  snippet: string;
  fetched: number;
  score: number;
  explain: Explain[];
  bonus: { title: number; phrase: number };
};

const K1 = 1.2;
const B = 0.75;

/**
 * Classement BM25 pour une requête, à partir des postings et des longueurs.
 * Tous les termes de la requête doivent être présents (ET), sauf si aucun document ne les réunit :
 * on bascule alors en OU pour ne pas répondre « rien » à une requête un peu trop précise.
 */
export function rank(
  queryTerms: string[],
  postings: Map<string, [number, number][]>,
  lengthOf: (id: number) => number,
  manifest: Pick<IndexManifest, "docs" | "avgLength">,
): { id: number; score: number; explain: Explain[] }[] {
  const unique = [...new Set(queryTerms)];
  if (!unique.length) return [];
  const scores = new Map<number, { score: number; explain: Explain[]; matched: number }>();
  for (const term of unique) {
    const list = postings.get(term) ?? [];
    const df = list.length;
    if (!df) continue;
    const idf = Math.log(1 + (manifest.docs - df + 0.5) / (df + 0.5));
    for (const [id, tf] of list) {
      const len = lengthOf(id) || manifest.avgLength;
      const part = idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * len) / manifest.avgLength)));
      const entry = scores.get(id) ?? { score: 0, explain: [], matched: 0 };
      entry.score += part;
      entry.matched++;
      entry.explain.push({ term, tf, df, idf: Math.round(idf * 100) / 100, score: Math.round(part * 100) / 100 });
      scores.set(id, entry);
    }
  }
  const all = [...scores].map(([id, e]) => ({ id, ...e }));
  const strict = all.filter((e) => e.matched === unique.length);
  return (strict.length ? strict : all).sort((a, b) => b.score - a.score).map(({ id, score, explain }) => ({ id, score, explain }));
}

type Fetcher = (url: string) => Promise<unknown>;

/** Client : charge l'index à la demande (morceaux mis en cache) et répond aux requêtes. */
export class WebIndex {
  private manifestPromise: Promise<IndexManifest> | null = null;
  private lengths: number[] = [];
  private shards = new Map<string, Promise<Shard>>();
  private docs = new Map<number, Promise<DocRecord[]>>();

  constructor(
    readonly base: string,
    private fetcher: Fetcher = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Index indisponible (${res.status})`);
      return res.json();
    },
  ) {}

  manifest() {
    this.manifestPromise ??= (this.fetcher(`${this.base}/index.json`) as Promise<IndexManifest>).then((m) => {
      this.lengths = m.lengths ? m.lengths.split(",").map((n) => parseInt(n, 36)) : [];
      return m;
    }).catch((error) => {
      this.manifestPromise = null;
      throw error;
    });
    return this.manifestPromise;
  }

  private shard(key: string) {
    let shard = this.shards.get(key);
    if (!shard) {
      shard = (this.fetcher(`${this.base}/t/${key}.json`) as Promise<Shard>).catch(() => ({}));
      this.shards.set(key, shard);
    }
    return shard;
  }

  private docShard(n: number) {
    let shard = this.docs.get(n);
    if (!shard) {
      shard = this.fetcher(`${this.base}/d/${n}.json`) as Promise<DocRecord[]>;
      shard.catch(() => this.docs.delete(n));
      this.docs.set(n, shard);
    }
    return shard;
  }

  private async doc(id: number) {
    return (await this.docShard(Math.floor(id / DOCS_PER_SHARD)))[id % DOCS_PER_SHARD];
  }

  async search(query: string, options: { limit?: number; host?: string } = {}) {
    const started = performance.now();
    const manifest = await this.manifest();
    const qTerms = terms(query);
    const available = new Set(manifest.shards);
    const postings = new Map<string, [number, number][]>();
    await Promise.all(
      [...new Set(qTerms)].map(async (term) => {
        const key = shardOf(term);
        if (!available.has(key)) return;
        postings.set(term, decodePostings((await this.shard(key))[term] ?? ""));
      }),
    );
    const ranked = rank(qTerms, postings, (id) => this.lengths[id] ?? manifest.avgLength, manifest);
    // Fiches chargées pour les meilleurs candidats seulement (les bonus peuvent réordonner le haut du classement).
    const limit = options.limit ?? 30;
    const head = options.host ? ranked : ranked.slice(0, Math.max(limit * 2, 60));
    const records = new Map<number, DocRecord>();
    await Promise.all([...new Set(head.map((r) => Math.floor(r.id / DOCS_PER_SHARD)))].map(async (n) => {
      const shard = await this.docShard(n);
      shard.forEach((rec, i) => records.set(n * DOCS_PER_SHARD + i, rec));
    }));
    const phrase = foldText(query).trim();
    const results: WebResult[] = [];
    for (const r of head) {
      const rec = records.get(r.id);
      if (!rec) continue;
      const [url, title, snippet, , fetched] = rec;
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (options.host && host !== options.host) continue;
      // Bonus explicables : tous les mots dans le titre, expression exacte dans le titre ou l'extrait.
      const titleTerms = new Set(terms(title));
      const titleBonus = qTerms.length && qTerms.every((t) => titleTerms.has(t)) ? 1.5 : 0;
      const phraseBonus = phrase.includes(" ") && (foldText(title).includes(phrase) || foldText(snippet).includes(phrase)) ? 1 : 0;
      results.push({ id: r.id, url, host, title, snippet, fetched, score: Math.round((r.score + titleBonus + phraseBonus) * 100) / 100, explain: r.explain, bonus: { title: titleBonus, phrase: phraseBonus } });
    }
    results.sort((a, b) => b.score - a.score);
    return { results: results.slice(0, limit), total: options.host ? results.length : ranked.length, ms: Math.round(performance.now() - started), manifest, terms: qTerms };
  }

  /** Utilisé par les tests et l'évaluation : accès direct à une fiche. */
  record(id: number) {
    return this.doc(id);
  }
}
