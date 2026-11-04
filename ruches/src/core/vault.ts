/**
 * Ruches — coffre local à alvéoles (cœur sans interface : réutilisable hors navigateur React).
 *
 * Chaque fichier est découpé par son contenu (chunker.ts) ; chaque alvéole est identifiée par son
 * empreinte SHA-256 et n'est stockée qu'une seule fois, compressée quand c'est utile.
 * Conséquences concrètes :
 * - un fichier importé deux fois, ou présent dans deux dossiers, ne coûte rien de plus ;
 * - chaque version d'un document ne stocke que ce qui a changé (historique quasi gratuit) ;
 * - tout tient dans un seul fichier « capsule » pour passer d'un appareil à l'autre, sans cloud.
 */
import { chunkBlob, LARGE, LARGE_FROM, SMALL } from "./chunker";
import { sheetText, type SheetData } from "./sheet";
import { openByteStore, type ByteStore } from "./store";

/**
 * Modèle universel : un objet = un identifiant stable, un type, des propriétés structurées,
 * un contenu éventuel (alvéoles versionnées) et des relations (dossier, espaces).
 * - contenu : file, doc, sheet ;
 * - organisation : folder (arborescence), space (espace vivant, appartenance multiple sans copie) ;
 * - objets structurés : event (agenda), task (tâches).
 */
export type NodeKind = "folder" | "file" | "doc" | "sheet" | "event" | "task" | "space";
export const CONTENT_KINDS: NodeKind[] = ["file", "doc", "sheet"];
export const DRIVE_KINDS: NodeKind[] = ["folder", "file", "doc", "sheet"];

export type EventProps = { start: number; end?: number; allDay?: boolean; place?: string; notes?: string; source?: string };
export type TaskProps = { done?: boolean; due?: number; notes?: string; source?: string };
export type SpaceProps = { color?: string; description?: string };
export type JsonProps = Record<string, string | number | boolean | null | undefined>;

export type Version = { at: number; size: number; chunks: string[] };

export type RucheNode = {
  id: string;
  kind: NodeKind;
  name: string;
  parent: string | null;
  created: number;
  updated: number;
  mime?: string;
  /** Versions, de la plus ancienne à la plus récente. Vide pour un dossier. */
  versions: Version[];
  starred?: boolean;
  trashed?: number;
  /** Texte extrait pour la recherche locale (tronqué). */
  text?: string;
  /** Propriétés structurées (événement, tâche, espace…). Petites valeurs JSON uniquement. */
  props?: JsonProps;
  /** Espaces auxquels l'objet appartient : une simple référence, jamais une copie. */
  spaces?: string[];
};

/** v1 : premier format (contenu seul). v2 : objets structurés et espaces (champs optionnels). */
type Manifest = { v: 2; nodes: Record<string, RucheNode>; stored: Record<string, number> };
export const MANIFEST_VERSION = 2;

export type VaultStats = {
  engine: ByteStore["engine"];
  files: number;
  /** Ce que pèseraient tous les fichiers et toutes leurs versions sans la Ruche. */
  logical: number;
  /** Ce qui est réellement écrit sur l'appareil. */
  physical: number;
  cells: number;
  versions: number;
};

const MANIFEST_KEY = "manifest.json";
const MAX_VERSIONS = 40;
/** Pendant l'édition, les enregistrements rapprochés fusionnent dans la même version. */
const COALESCE_MS = 2 * 60 * 1000;
const TEXT_LIMIT = 50_000;

// Formats déjà compressés : inutile de dépenser du processeur à les recompresser.
const PACKED =
  /^(image\/(jpeg|png|gif|webp|avif|heic|heif)|video\/|audio\/(?!wav|x-wav)|application\/(zip|gzip|x-7z|x-rar|vnd\.rar|x-xz|zstd|pdf|epub|vnd\.openxmlformats|vnd\.oasis))/i;

const enc = new TextEncoder();
const dec = new TextDecoder();

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const cellKey = (hash: string) => `c/${hash.slice(0, 2)}/${hash}`;

async function sha256(data: Uint8Array) {
  return toHex(await crypto.subtle.digest("SHA-256", data as Uint8Array<ArrayBuffer>));
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Encodage d'une alvéole : 1 octet d'en-tête (0 brut, 1 deflate) puis les données. */
async function encodeCell(raw: Uint8Array, tryCompress: boolean) {
  if (tryCompress && typeof CompressionStream !== "undefined" && raw.length > 256) {
    const packed = await pipe(raw, new CompressionStream("deflate"));
    if (packed.length < raw.length * 0.95) return concat([Uint8Array.of(1), packed]);
  }
  return concat([Uint8Array.of(0), raw]);
}

async function decodeCell(stored: Uint8Array) {
  const body = stored.subarray(1);
  return stored[0] === 1 ? pipe(body, new DecompressionStream("deflate")) : body;
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const newId = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Minuscules sans accents : « Événement » et « evenement » se retrouvent. */
export function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export class Vault {
  private manifest: Manifest = { v: 2, nodes: {}, stored: {} };
  private refs = new Map<string, number>();
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private channel: BroadcastChannel | null = null;

  private constructor(
    private store: ByteStore,
    readonly ns: string,
  ) {}

  static async open(ns: string, options: { store?: ByteStore; broadcast?: boolean } = {}) {
    const vault = new Vault(options.store ?? (await openByteStore(ns)), ns);
    await vault.load();
    if (options.broadcast !== false && typeof BroadcastChannel !== "undefined") {
      // Un autre onglet a modifié la Ruche : on relit le manifeste.
      vault.channel = new BroadcastChannel(`ruche-${ns}`);
      // Relecture placée dans la file : jamais au milieu d'une écriture en cours dans cet onglet.
      vault.channel.onmessage = () => void vault.serial(async () => undefined).then(() => vault.emit(false));
    }
    return vault;
  }

  get engine() {
    return this.store.engine;
  }

  private async load() {
    const raw = await this.store.get(MANIFEST_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(dec.decode(raw)) as { v?: number } & Omit<Manifest, "v">;
        // Migration v1 → v2 : les nouveaux champs sont optionnels, rien à réécrire.
        if (parsed?.v === 1 || parsed?.v === 2) this.manifest = { ...parsed, v: 2 };
      } catch {
        /* manifeste illisible : on garde l'état en mémoire */
      }
    } else {
      // Rien d'enregistré : coffre vide (y compris après l'annulation d'une première écriture).
      this.manifest = { v: 2, nodes: {}, stored: {} };
    }
    this.rebuildRefs();
  }

  private rebuildRefs() {
    this.refs.clear();
    for (const node of Object.values(this.manifest.nodes))
      for (const version of node.versions)
        for (const hash of version.chunks) this.refs.set(hash, (this.refs.get(hash) ?? 0) + 1);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit(broadcast = true) {
    for (const fn of this.listeners) fn();
    if (broadcast) this.channel?.postMessage("changed");
  }

  /**
   * Les écritures passent une par une, y compris entre onglets (verrou du navigateur) :
   * chaque écriture repart du dernier manifeste enregistré, aucun onglet n'écrase l'autre.
   */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const fresh = async () => {
      await this.load();
      return task();
    };
    const locked = () =>
      typeof navigator !== "undefined" && navigator.locks
        ? (navigator.locks.request(`ruche-${this.ns}`, fresh) as Promise<T>)
        : fresh();
    const run = this.queue.then(locked, locked);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async commit() {
    await this.store.put(MANIFEST_KEY, enc.encode(JSON.stringify(this.manifest)));
    this.emit();
  }

  // ——— Lecture ———

  node(id: string): RucheNode | undefined {
    return this.manifest.nodes[id];
  }

  all(): RucheNode[] {
    return Object.values(this.manifest.nodes);
  }

  children(parent: string | null): RucheNode[] {
    return this.all()
      .filter((n) => n.parent === parent && !n.trashed && DRIVE_KINDS.includes(n.kind))
      .sort(
        (a, b) =>
          Number(b.kind === "folder") - Number(a.kind === "folder") ||
          a.name.localeCompare(b.name, "fr", { numeric: true }),
      );
  }

  path(id: string | null): RucheNode[] {
    const out: RucheNode[] = [];
    let current = id ? this.node(id) : undefined;
    while (current && out.length < 64) {
      out.unshift(current);
      current = current.parent ? this.node(current.parent) : undefined;
    }
    return out;
  }

  /** Vrai si l'élément ou l'un de ses dossiers parents est à la corbeille. */
  isTrashed(node: RucheNode) {
    return this.path(node.id).some((n) => n.trashed);
  }

  /** Derniers éléments modifiés, hors dossiers et corbeille. */
  recent(limit = 8) {
    return this.all()
      .filter((n) => CONTENT_KINDS.includes(n.kind) && !this.isTrashed(n))
      .sort((a, b) => b.updated - a.updated)
      .slice(0, limit);
  }

  sizeOf(node: RucheNode) {
    return node.versions.at(-1)?.size ?? 0;
  }

  stats(): VaultStats {
    let logical = 0;
    let files = 0;
    let versions = 0;
    for (const node of this.all()) {
      if (!CONTENT_KINDS.includes(node.kind)) continue;
      files++;
      versions += node.versions.length;
      for (const v of node.versions) logical += v.size;
    }
    const physical = Object.values(this.manifest.stored).reduce((a, b) => a + b, 0);
    return {
      engine: this.engine,
      files,
      logical,
      physical,
      cells: Object.keys(this.manifest.stored).length,
      versions,
    };
  }

  /** Reconstitue le contenu d'une version (la dernière par défaut). */
  async read(id: string, versionIndex?: number, type?: string): Promise<Blob> {
    const node = this.node(id);
    const version = node?.versions[versionIndex ?? node.versions.length - 1];
    if (!node || !version) return new Blob([], { type: type ?? node?.mime ?? "" });
    // Les alvéoles brutes restent des tranches de fichiers sur le disque (OPFS) : une grosse vidéo
    // n'est jamais chargée en mémoire. Seules les alvéoles compressées (texte, petites) sont décodées.
    const parts: BlobPart[] = [];
    for (const hash of version.chunks) {
      const stored = await this.store.getBlob(cellKey(hash));
      if (!stored) throw new Error("Une alvéole de ce fichier est introuvable sur cet appareil.");
      const flag = new Uint8Array(await stored.slice(0, 1).arrayBuffer())[0];
      parts.push(flag === 1 ? ((await decodeCell(new Uint8Array(await stored.arrayBuffer()))) as Uint8Array<ArrayBuffer>) : stored.slice(1));
    }
    return new Blob(parts, { type: type ?? node.mime ?? "application/octet-stream" });
  }

  async readText(id: string, versionIndex?: number) {
    return (await this.read(id, versionIndex)).text();
  }

  // ——— Écriture ———

  /** Découpe, déduplique et écrit les alvéoles d'un contenu ; renvoie la version obtenue. */
  private async ingest(
    blob: Blob,
    mime: string,
    onProgress?: (done: number) => void,
  ): Promise<Version> {
    const params = blob.size >= LARGE_FROM ? LARGE : SMALL;
    const compress = !PACKED.test(mime);
    const chunks: string[] = [];
    const written: string[] = [];
    let done = 0;
    try {
      for await (const raw of chunkBlob(blob, params)) {
        const hash = await sha256(raw);
        if (this.manifest.stored[hash] === undefined) {
          const cell = await encodeCell(raw, compress);
          await this.store.put(cellKey(hash), cell);
          this.manifest.stored[hash] = cell.length;
          written.push(hash);
        }
        chunks.push(hash);
        done += raw.length;
        onProgress?.(done);
      }
    } catch (error) {
      // Échec en cours de route (place insuffisante…) : on retire les alvéoles orphelines.
      for (const hash of written) {
        delete this.manifest.stored[hash];
        await this.store.del(cellKey(hash)).catch(() => undefined);
      }
      throw error;
    }
    return { at: Date.now(), size: blob.size, chunks };
  }

  private addRefs(version: Version, delta: 1 | -1) {
    for (const hash of version.chunks) this.refs.set(hash, (this.refs.get(hash) ?? 0) + delta);
  }

  /** Supprime les alvéoles qui ne servent plus à aucune version. */
  /**
   * Retire du manifeste les alvéoles qui ne servent plus. Elles ne sont effacées du disque
   * qu'APRÈS l'enregistrement du manifeste (dropCells) : si l'enregistrement échoue,
   * le manifeste encore sur le disque ne pointe jamais vers une alvéole effacée.
   */
  private prune(candidates: Iterable<string>) {
    const dead: string[] = [];
    for (const hash of new Set(candidates)) {
      if ((this.refs.get(hash) ?? 0) > 0) continue;
      this.refs.delete(hash);
      delete this.manifest.stored[hash];
      dead.push(hash);
    }
    return dead;
  }

  private async dropCells(hashes: string[]) {
    for (const hash of hashes) await this.store.del(cellKey(hash)).catch(() => undefined);
  }

  private uniqueName(parent: string | null, name: string, except?: string) {
    const taken = new Set(
      this.children(parent)
        .filter((n) => n.id !== except)
        .map((n) => n.name.toLowerCase()),
    );
    if (!taken.has(name.toLowerCase())) return name;
    const dot = name.lastIndexOf(".");
    const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    for (let i = 2; ; i++)
      if (!taken.has(`${base} (${i})${ext}`.toLowerCase())) return `${base} (${i})${ext}`;
  }

  createFolder(parent: string | null, name: string) {
    return this.serial(async () => {
      const now = Date.now();
      const node: RucheNode = {
        id: newId(),
        kind: "folder",
        name: this.uniqueName(parent, name.trim() || "Nouveau dossier"),
        parent,
        created: now,
        updated: now,
        versions: [],
      };
      this.manifest.nodes[node.id] = node;
      await this.commit();
      return node;
    });
  }

  /** Importe un fichier de l'appareil dans la Ruche. */
  importFile(parent: string | null, file: File, onProgress?: (done: number) => void) {
    return this.serial(async () => {
      const mime = file.type || "application/octet-stream";
      const version = await this.ingest(file, mime, onProgress);
      const now = Date.now();
      const node: RucheNode = {
        id: newId(),
        kind: "file",
        name: this.uniqueName(parent, file.name || "Sans nom"),
        parent,
        created: now,
        updated: now,
        mime,
        versions: [version],
        text: await extractFileText(file, mime),
      };
      this.manifest.nodes[node.id] = node;
      this.addRefs(version, 1);
      await this.commit();
      return node;
    });
  }

  /** Crée un document (Plume) ou une grille (Grille). */
  createContent(
    parent: string | null,
    kind: "doc" | "sheet",
    name: string,
    content: string,
    text = "",
  ) {
    return this.serial(async () => {
      const mime = kind === "doc" ? "text/html" : "application/json";
      const version = await this.ingest(new Blob([content]), mime);
      const now = Date.now();
      const node: RucheNode = {
        id: newId(),
        kind,
        name: this.uniqueName(parent, name),
        parent,
        created: now,
        updated: now,
        mime,
        versions: [version],
        text: text.slice(0, TEXT_LIMIT),
      };
      this.manifest.nodes[node.id] = node;
      this.addRefs(version, 1);
      await this.commit();
      return node;
    });
  }

  /** Enregistre un nouveau contenu ; les enregistrements rapprochés remplacent la dernière version. */
  saveContent(id: string, content: string, text: string) {
    return this.serial(async () => {
      const node = this.node(id);
      if (!node) return;
      const version = await this.ingest(new Blob([content]), node.mime ?? "text/plain");
      const last = node.versions.at(-1);
      if (last && last.chunks.join() === version.chunks.join()) return;
      const released: string[] = [];
      if (
        last &&
        node.versions.length > 1 &&
        version.at - last.at < COALESCE_MS &&
        version.at - node.versions[node.versions.length - 2].at < COALESCE_MS * 15
      ) {
        // Même session d'écriture : on remplace l'instantané en cours.
        this.addRefs(last, -1);
        released.push(...last.chunks);
        node.versions[node.versions.length - 1] = version;
      } else {
        node.versions.push(version);
      }
      while (node.versions.length > MAX_VERSIONS) {
        const old = node.versions.shift() as Version;
        this.addRefs(old, -1);
        released.push(...old.chunks);
      }
      this.addRefs(version, 1);
      node.updated = version.at;
      node.text = text.slice(0, TEXT_LIMIT);
      const dead = this.prune(released);
      await this.commit();
      await this.dropCells(dead);
    });
  }

  /** Revient à une ancienne version (en l'ajoutant comme nouvelle version : rien n'est perdu). */
  restore(id: string, versionIndex: number) {
    return this.serial(async () => {
      const node = this.node(id);
      const source = node?.versions[versionIndex];
      if (!node || !source) return;
      const copy: Version = { at: Date.now(), size: source.size, chunks: [...source.chunks] };
      node.versions.push(copy);
      this.addRefs(copy, 1);
      // Même limite que les enregistrements : 40 versions, les plus anciennes libèrent leurs alvéoles.
      const released: string[] = [];
      while (node.versions.length > MAX_VERSIONS) {
        const old = node.versions.shift() as Version;
        this.addRefs(old, -1);
        released.push(...old.chunks);
      }
      node.updated = copy.at;
      node.text = await this.textOf(node);
      const dead = this.prune(released);
      await this.commit();
      await this.dropCells(dead);
    });
  }

  /** Texte indexé de la version courante, recalculé depuis son contenu. */
  private async textOf(node: RucheNode) {
    try {
      const blob = await this.read(node.id);
      if (node.kind === "doc") return htmlToText(await blob.text()).slice(0, TEXT_LIMIT);
      if (node.kind === "sheet")
        return sheetText(JSON.parse(await blob.text()) as SheetData).slice(0, TEXT_LIMIT);
      return await extractFileText(new File([blob], node.name), node.mime ?? "");
    } catch {
      return undefined;
    }
  }

  update(id: string, patch: Partial<Pick<RucheNode, "name" | "parent" | "starred" | "trashed">>) {
    return this.serial(async () => {
      const node = this.node(id);
      if (!node) return;
      if (
        patch.parent !== undefined &&
        patch.parent !== null &&
        this.path(patch.parent).some((n) => n.id === id)
      )
        throw new Error("Impossible de ranger un dossier dans lui-même.");
      const parent = patch.parent === undefined ? node.parent : patch.parent;
      Object.assign(node, patch);
      if (patch.name !== undefined || patch.parent !== undefined)
        node.name = this.uniqueName(parent, (patch.name ?? node.name).trim() || node.name, id);
      if (patch.name !== undefined) node.updated = Date.now();
      await this.commit();
    });
  }

  /** Corbeille : un dossier y part avec tout son contenu (réversible). */
  trash(id: string, restore = false) {
    return this.serial(async () => {
      const node = this.node(id);
      if (!node) return;
      node.trashed = restore ? undefined : Date.now();
      // Restaurer sous un dossier encore à la corbeille le rendrait invisible : retour à la racine.
      if (restore && node.parent && this.path(node.parent).some((n) => n.trashed))
        node.parent = null;
      // Un homonyme a pu être créé entretemps : le restauré prend un nom distinct.
      if (restore && DRIVE_KINDS.includes(node.kind)) node.name = this.uniqueName(node.parent, node.name, id);
      await this.commit();
    });
  }

  trashed(): RucheNode[] {
    // Seuls les éléments jetés directement (pas ceux contenus dans un dossier jeté).
    return this.all()
      .filter((n) => n.trashed && !(n.parent && this.node(n.parent)?.trashed))
      .sort((a, b) => (b.trashed ?? 0) - (a.trashed ?? 0));
  }

  /** Suppression définitive d'éléments de la corbeille (et de tout ce qu'ils contiennent). */
  purge(ids: string[]) {
    return this.serial(async () => {
      const doomed = new Set<string>();
      const visit = (id: string) => {
        doomed.add(id);
        for (const child of this.all())
          if (child.parent === id && !doomed.has(child.id)) visit(child.id);
      };
      ids.forEach(visit);
      const released: string[] = [];
      for (const id of doomed) {
        const node = this.node(id);
        if (!node) continue;
        for (const version of node.versions) {
          this.addRefs(version, -1);
          released.push(...version.chunks);
        }
        delete this.manifest.nodes[id];
      }
      // Un espace supprimé disparaît des objets qui le référençaient (les objets, eux, restent).
      for (const node of this.all()) if (node.spaces?.some((sp) => doomed.has(sp))) node.spaces = node.spaces.filter((sp) => !doomed.has(sp));
      const dead = this.prune(released);
      await this.commit();
      await this.dropCells(dead);
    });
  }

  // ——— Objets structurés : événements, tâches, espaces ———

  /** Objets d'un type, hors corbeille. */
  objects(kind: NodeKind) {
    return this.all().filter((n) => n.kind === kind && !n.trashed);
  }

  /** Tout ce qui appartient à un espace, quel que soit le type. */
  members(spaceId: string) {
    return this.all().filter((n) => n.spaces?.includes(spaceId) && !this.isTrashed(n));
  }

  createObject(kind: "event" | "task" | "space", name: string, props: JsonProps = {}, spaces: string[] = []) {
    return this.serial(async () => {
      const now = Date.now();
      const clean = cleanProps(props);
      const node: RucheNode = { id: newId(), kind, name: name.trim().slice(0, 200) || "Sans titre", parent: null, created: now, updated: now, versions: [], props: clean, spaces: spaces.filter((sp) => this.node(sp)?.kind === "space") };
      node.text = propsText(node);
      this.manifest.nodes[node.id] = node;
      await this.commit();
      return node;
    });
  }

  /** Met à jour le nom ou les propriétés d'un objet (undefined retire une propriété). */
  updateObject(id: string, patch: { name?: string; props?: JsonProps }) {
    return this.serial(async () => {
      const node = this.node(id);
      if (!node) return;
      if (patch.name !== undefined) node.name = patch.name.trim().slice(0, 200) || node.name;
      if (patch.props) node.props = cleanProps({ ...node.props, ...patch.props });
      if (!CONTENT_KINDS.includes(node.kind)) node.text = propsText(node);
      node.updated = Date.now();
      await this.commit();
    });
  }

  /** Ajoute ou retire un objet d'un espace : aucune copie, une simple référence. */
  toggleSpace(id: string, spaceId: string, member?: boolean) {
    return this.serial(async () => {
      const node = this.node(id);
      if (!node || this.node(spaceId)?.kind !== "space" || id === spaceId) return;
      const has = node.spaces?.includes(spaceId) ?? false;
      const want = member ?? !has;
      if (want === has) return;
      node.spaces = want ? [...(node.spaces ?? []), spaceId] : (node.spaces ?? []).filter((sp) => sp !== spaceId);
      await this.commit();
    });
  }

  // ——— Recherche ———

  search(query: string, limit = 50) {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const results: { node: RucheNode; score: number; snippet: string }[] = [];
    for (const node of this.all()) {
      if (this.isTrashed(node)) continue;
      const name = fold(node.name);
      const text = node.text ? fold(node.text) : "";
      let score = 0;
      let firstHit = -1;
      for (const term of terms) {
        const inName = name.includes(term);
        const at = text.indexOf(term);
        if (!inName && at < 0) {
          score = 0;
          break;
        }
        score += (inName ? 10 : 0) + (name.startsWith(term) ? 5 : 0);
        if (at >= 0) {
          score += 2 + Math.min(text.split(term).length - 2, 8);
          if (firstHit < 0) firstHit = at;
        }
      }
      if (score <= 0) continue;
      const source = node.text ?? "";
      const snippet =
        firstHit >= 0
          ? `${firstHit > 60 ? "…" : ""}${source
              .slice(Math.max(0, firstHit - 60), firstHit + 140)
              .replace(/\s+/g, " ")
              .trim()}…`
          : "";
      results.push({ node, score: score + (node.starred ? 3 : 0), snippet });
    }
    return results
      .sort((a, b) => b.score - a.score || b.node.updated - a.node.updated)
      .slice(0, limit);
  }

  // ——— Capsule : tout le coffre dans un seul fichier, pour changer d'appareil sans cloud ———

  /**
   * Arborescence saine : seul un dossier peut être parent, seuls les fichiers, documents, grilles
   * et dossiers ont un parent, et aucune boucle n'est possible. Sinon l'élément revient à la racine.
   */
  private repairParents() {
    for (const node of this.all()) {
      if (!node.parent) continue;
      const parent = this.manifest.nodes[node.parent];
      let broken = !parent || parent.kind !== "folder" || !DRIVE_KINDS.includes(node.kind);
      const seen = new Set([node.id]);
      for (let cur = parent; !broken && cur?.parent; cur = this.manifest.nodes[cur.parent]) {
        if (seen.has(cur.id) || seen.size > 256) broken = true;
        seen.add(cur.id);
      }
      if (broken) node.parent = null;
    }
  }

  /** Instantané cohérent : l'export passe dans la file d'écriture (aucune sauvegarde ne s'intercale). */
  exportCapsule(): Promise<Blob> {
    return this.serial(() => this.buildCapsule());
  }

  private async buildCapsule(): Promise<Blob> {
    const header = enc.encode(
      JSON.stringify({ v: 1, exported: Date.now(), nodes: this.manifest.nodes }),
    );
    const parts: BlobPart[] = [enc.encode("RUCHE1\n"), u32(header.length), header];
    // Sur OPFS, chaque alvéole est un fichier du disque : la capsule les assemble sans les charger en mémoire.
    for (const hash of Object.keys(this.manifest.stored)) {
      const cell = await this.store.getBlob(cellKey(hash));
      if (!cell) continue;
      parts.push(hexToBytes(hash), u32(cell.size), cell);
    }
    return new Blob(parts, { type: "application/octet-stream" });
  }

  /** Fusionne une capsule : les alvéoles déjà présentes ne sont pas réécrites. */
  importCapsule(file: Blob) {
    return this.serial(async () => {
      // Lecture par morceaux : la capsule n'est jamais chargée entière en mémoire.
      let at = 0;
      const read = async (n: number) => {
        const bytes = new Uint8Array(await file.slice(at, at + n).arrayBuffer());
        at += n;
        if (bytes.length !== n) throw new Error("Capsule incomplète ou abîmée.");
        return bytes;
      };
      const u32At = (bytes: Uint8Array, offset: number) =>
        new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset);
      if (file.size < 11 || dec.decode(await read(7)) !== "RUCHE1\n")
        throw new Error("Ce fichier n'est pas une capsule Ruche.");
      const headerLength = u32At(await read(4), 0);
      if (headerLength > file.size - at) throw new Error("Capsule incomplète ou abîmée.");
      let header: { nodes?: unknown };
      try {
        header = JSON.parse(dec.decode(await read(headerLength))) as { nodes?: unknown };
      } catch {
        throw new Error("Capsule illisible.");
      }
      let cells = 0;
      const written: string[] = [];
      try {
        while (at + 36 <= file.size) {
          const head = await read(36);
          const hash = toHex(head.slice(0, 32).buffer);
          const length = u32At(head, 32);
          if (length > file.size - at) throw new Error("Capsule incomplète ou abîmée.");
          if (this.manifest.stored[hash] !== undefined) {
            at += length;
            continue;
          }
          const cell = await read(length);
          // Vérification d'intégrité : l'empreinte doit correspondre au contenu.
          if ((await sha256(await decodeCell(cell))) !== hash)
            throw new Error("Capsule abîmée : une alvéole ne correspond pas à son empreinte. Rien n'a été importé.");
          await this.store.put(cellKey(hash), cell);
          this.manifest.stored[hash] = length;
          written.push(hash);
          cells++;
        }
        // Le fichier doit être lu jusqu'au dernier octet : un reste partiel signale une capsule tronquée.
        if (at !== file.size) throw new Error("Capsule incomplète ou abîmée.");
        const incoming =
          header.nodes && typeof header.nodes === "object"
            ? Object.values(header.nodes as Record<string, unknown>)
            : [];
        const accepted: RucheNode[] = [];
        const seen = new Set<string>();
        for (const raw of incoming) {
          const node = normalizeNode(raw);
          if (!node) continue;
          // Deux entrées au même identifiant : l'une écraserait l'autre en silence. Capsule refusée.
          if (seen.has(node.id)) throw new Error("Capsule incohérente : un même élément y figure deux fois. Rien n'a été importé.");
          seen.add(node.id);
          if (this.manifest.nodes[node.id]) continue;
          if (node.versions.some((v) => v.chunks.some((h) => this.manifest.stored[h] === undefined)))
            throw new Error("Capsule incomplète : un élément référence une alvéole absente. Rien n'a été importé.");
          accepted.push(node);
        }
        for (const node of accepted) this.manifest.nodes[node.id] = node;
        this.repairParents();
        this.rebuildRefs();
        await this.commit();
        return { added: accepted.length, cells };
      } catch (error) {
        // Capsule tronquée, incohérente ou place insuffisante : rien d'orphelin ne reste sur l'appareil.
        for (const hash of written) await this.store.del(cellKey(hash)).catch(() => undefined);
        await this.load();
        throw error;
      }
    });
  }
}

const KINDS: NodeKind[] = ["folder", "file", "doc", "sheet", "event", "task", "space"];

/** Propriétés : petites valeurs JSON simples uniquement (pas d'objets imbriqués), 20 Ko au plus. */
function cleanProps(props: unknown): JsonProps | undefined {
  if (!props || typeof props !== "object" || Array.isArray(props)) return undefined;
  const out: JsonProps = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>).slice(0, 50)) {
    if (key.length > 40 || value === undefined) continue;
    if (typeof value === "string") out[key] = value.slice(0, 5000);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean" || value === null) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Texte cherchable d'un objet structuré (nom + lieu + notes…). */
function propsText(node: RucheNode) {
  return Object.values(node.props ?? {}).filter((v) => typeof v === "string").join(" ").slice(0, TEXT_LIMIT) || undefined;
}

/** Une capsule peut venir d'ailleurs : on ne garde que des éléments au format attendu. */
function normalizeNode(raw: unknown): RucheNode | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  if (
    typeof n.id !== "string" ||
    !n.id ||
    n.id.length > 64 ||
    typeof n.name !== "string" ||
    !KINDS.includes(n.kind as NodeKind) ||
    !Array.isArray(n.versions)
  )
    return null;
  const versions: Version[] = [];
  for (const v of n.versions as unknown[]) {
    const version = v as Record<string, unknown> | null;
    if (
      !version ||
      !Array.isArray(version.chunks) ||
      !version.chunks.every((h) => typeof h === "string" && /^[0-9a-f]{64}$/.test(h))
    )
      return null;
    versions.push({
      at: num(version.at, Date.now()),
      size: num(version.size, 0),
      chunks: version.chunks as string[],
    });
  }
  const kind = n.kind as NodeKind;
  if (CONTENT_KINDS.includes(kind) ? versions.length === 0 : versions.length > 0) return null;
  const now = Date.now();
  return {
    id: n.id,
    kind,
    name: n.name.trim().slice(0, 200) || "Sans nom",
    parent: typeof n.parent === "string" && n.parent.length <= 64 ? n.parent : null,
    created: num(n.created, now),
    updated: num(n.updated, now),
    mime: typeof n.mime === "string" ? n.mime.slice(0, 200) : undefined,
    versions: versions.slice(-MAX_VERSIONS),
    starred: n.starred === true ? true : undefined,
    trashed: typeof n.trashed === "number" && Number.isFinite(n.trashed) ? n.trashed : undefined,
    text: typeof n.text === "string" ? n.text.slice(0, TEXT_LIMIT) : undefined,
    props: cleanProps(n.props),
    spaces: Array.isArray(n.spaces) ? (n.spaces as unknown[]).filter((sp): sp is string => typeof sp === "string" && sp.length <= 64).slice(0, 50) : undefined,
  };
}

function u32(n: number) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n);
  return out;
}

function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const TEXTUAL = /^(text\/|application\/(json|xml|javascript|x-ndjson|x-yaml|yaml|csv|rtf))|\+xml$/i;
const TEXT_EXT =
  /\.(txt|md|markdown|csv|tsv|json|xml|html?|ya?ml|log|ini|conf|srt|vtt|js|ts|tsx|jsx|css|py|rs|java|c|h|cpp|sh|sql)$/i;

/** Fichier lisible comme du texte (type déclaré ou extension), pour l'index comme pour l'aperçu. */
export function isTextual(name: string, mime: string) {
  return TEXTUAL.test(mime) || TEXT_EXT.test(name);
}

/** Texte indexable d'un fichier importé (texte brut uniquement, sans rien envoyer nulle part). */
async function extractFileText(file: File, mime: string) {
  if (file.size > 5 * 1024 * 1024 || !isTextual(file.name, mime)) return undefined;
  try {
    const text = await file.slice(0, TEXT_LIMIT * 4).text();
    return (/html/i.test(mime) || /\.html?$/i.test(file.name) ? htmlToText(text) : text).slice(
      0,
      TEXT_LIMIT,
    );
  } catch {
    return undefined;
  }
}

export function htmlToText(html: string) {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, " ");
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach((el) => el.remove());
  doc.querySelectorAll("p,div,li,h1,h2,h3,br,blockquote,pre,tr").forEach((el) => el.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

const vaults = new Map<string, Promise<Vault>>();

/** Une seule instance par espace et par onglet. */
export function openVault(ns: string) {
  let vault = vaults.get(ns);
  if (!vault) {
    vault = Vault.open(ns);
    vault.catch(() => vaults.delete(ns));
    vaults.set(ns, vault);
  }
  return vault;
}
