/**
 * Ruches pour le web — moteur de site en alvéoles (cœur sans interface, sans dépendance).
 *
 * Une page est un arbre de contenu (JSON). Le moteur le découpe en alvéoles :
 * chaque objet placé dans une liste (une section, une carte, un bouton…) devient une alvéole
 * identifiée par l'empreinte SHA-256 de son contenu. Une alvéole qui contient des alvéoles ne garde
 * que leurs empreintes : la page entière forme un arbre de Merkle, et son empreinte racine
 * résume tout son contenu.
 *
 * Conséquences :
 * - une alvéole identique (même bouton, même carte) n'est stockée qu'une fois, quelle que soit la page ;
 * - une alvéole ne change jamais : modifier un texte crée une nouvelle alvéole, l'ancienne reste
 *   (l'historique est gratuit et vérifiable) ;
 * - au moment d'assembler, chaque alvéole est revérifiée par son empreinte : une alvéole altérée
 *   est refusée.
 *
 * L'assemblage se fait côté serveur : le visiteur reçoit une page HTML normale, rien n'est stocké
 * chez lui.
 *
 * Alvéoles vivantes : dans une source, `{ "$nom": "x" }` insère l'alvéole partagée « x ».
 * La modifier une fois met à jour toutes les pages qui l'utilisent.
 */

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export type Ref = { $a: string };
export type Store = Map<string, string>;

/** Plan d'une page : son empreinte racine actuelle et l'historique de ses versions. */
export type Plan = {
  page: string;
  racine: string;
  historique: { racine: string; date: string }[];
};

export type Stats = { blocs: number; uniques: number; octets: number };

/** Page assemblée, telle que renvoyée au rendu. */
export type PageAlveoles<T> = { contenu: T; stats: Stats; racine: string; versions: Plan["historique"] };

/** JSON canonique : clés triées, aucun espace. Deux contenus égaux ont toujours le même texte. */
export function canonique(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (v && typeof v === "object") {
    const cles = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return `{${cles.map((k) => `${JSON.stringify(k)}:${canonique(v[k] as Json)}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export async function empreinte(texte: string): Promise<string> {
  const octets = new TextEncoder().encode(texte);
  const h = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const estObjet = (v: unknown): v is { [k: string]: Json } => !!v && typeof v === "object" && !Array.isArray(v);
const estRef = (v: unknown): v is Ref => estObjet(v) && typeof v.$a === "string" && Object.keys(v).length === 1;

/** Remplace les `{ "$nom": "x" }` par les alvéoles partagées correspondantes. */
export function resoudreNoms(v: Json, partagees: Record<string, Json>, pile: string[] = []): Json {
  if (Array.isArray(v)) return v.map((x) => resoudreNoms(x, partagees, pile));
  if (!estObjet(v)) return v;
  if (typeof v.$nom === "string") {
    const nom = v.$nom;
    if (pile.includes(nom)) throw new Error(`Alvéole partagée circulaire : ${[...pile, nom].join(" → ")}`);
    if (!(nom in partagees)) throw new Error(`Alvéole partagée inconnue : ${nom}`);
    return resoudreNoms(partagees[nom], partagees, [...pile, nom]);
  }
  const out: { [k: string]: Json } = {};
  for (const k of Object.keys(v)) out[k] = resoudreNoms(v[k], partagees, pile);
  return out;
}

/**
 * Découpe un contenu en alvéoles et renvoie l'empreinte racine.
 * Les objets placés dans des listes deviennent des alvéoles ; les petits objets isolés (un lien)
 * restent dans leur alvéole parente.
 */
export async function decouper(contenu: Json, store: Store): Promise<string> {
  async function noeud(v: Json): Promise<Json> {
    if (Array.isArray(v)) {
      const out: Json[] = [];
      for (const x of v) out.push(estObjet(x) ? { $a: await alveole(x) } : await noeud(x));
      return out;
    }
    if (estObjet(v)) {
      if ("$a" in v || "$nom" in v) throw new Error("Clé réservée ($a ou $nom) dans un contenu déjà résolu");
      const out: { [k: string]: Json } = {};
      for (const k of Object.keys(v)) out[k] = await noeud(v[k]);
      return out;
    }
    return v;
  }
  async function alveole(v: { [k: string]: Json }): Promise<string> {
    const texte = canonique(await noeud(v));
    const h = await empreinte(texte);
    store.set(h, texte);
    return h;
  }
  if (!estObjet(contenu)) throw new Error("Une page doit être un objet JSON");
  return alveole(contenu);
}

/** Reconstitue le contenu à partir de l'empreinte racine, en vérifiant chaque alvéole. */
export async function assembler<T = Json>(racine: string, lire: (h: string) => string | undefined): Promise<{ contenu: T; stats: Stats }> {
  const vues = new Map<string, Json>();
  let blocs = 0;
  async function charger(h: string, pile: string[]): Promise<Json> {
    blocs++;
    if (pile.includes(h)) throw new Error(`Alvéole circulaire : ${h.slice(0, 12)}`);
    const deja = vues.get(h);
    if (deja !== undefined) return deja;
    const texte = lire(h);
    if (texte === undefined) throw new Error(`Alvéole manquante : ${h.slice(0, 12)}`);
    if ((await empreinte(texte)) !== h) throw new Error(`Alvéole altérée : ${h.slice(0, 12)}`);
    const v = await developper(JSON.parse(texte) as Json, [...pile, h]);
    vues.set(h, v);
    return v;
  }
  async function developper(v: Json, pile: string[]): Promise<Json> {
    if (Array.isArray(v)) {
      const out: Json[] = [];
      for (const x of v) out.push(estRef(x) ? await charger(x.$a, pile) : await developper(x, pile));
      return out;
    }
    if (estObjet(v)) {
      const out: { [k: string]: Json } = {};
      for (const k of Object.keys(v)) out[k] = await developper(v[k], pile);
      return out;
    }
    return v;
  }
  const contenu = (await charger(racine, [])) as T;
  let octets = 0;
  for (const h of vues.keys()) octets += new TextEncoder().encode(lire(h) ?? "").length;
  return { contenu, stats: { blocs, uniques: vues.size, octets } };
}

/** Chemin de stockage d'une alvéole : 2 premiers caractères en dossier, comme le coffre Ruches. */
export const cheminAlveole = (h: string) => `${h.slice(0, 2)}/${h.slice(2)}.json`;

/** Ajoute une version au plan seulement si le contenu a réellement changé. */
export function nouvellePlan(page: string, racine: string, ancien: Plan | undefined, date: string): Plan {
  if (ancien && ancien.racine === racine) return ancien;
  const historique = [...(ancien?.historique ?? []), { racine, date }];
  return { page, racine, historique };
}
