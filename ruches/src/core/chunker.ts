/**
 * Découpage par le contenu (content-defined chunking, famille FastCDC).
 *
 * Les coupures dépendent des octets eux-mêmes, pas de leur position : insérer une phrase au début
 * d'un document ne décale qu'une ou deux alvéoles, toutes les autres restent identiques et ne sont
 * jamais stockées deux fois. C'est ce qui rend les doublons et l'historique des versions presque gratuits.
 */

export type ChunkParams = { min: number; avg: number; max: number };

/** Petits fichiers et documents : alvéoles fines (≈ 4 Kio). */
export const SMALL: ChunkParams = { min: 1024, avg: 4096, max: 16384 };
/** Gros fichiers (photos, vidéos…) : alvéoles larges (≈ 256 Kio), pour garder un index léger. */
export const LARGE: ChunkParams = { min: 65536, avg: 262144, max: 1048576 };
export const LARGE_FROM = 4 * 1024 * 1024;

// Table « gear » fixe : générée à partir d'une graine constante pour que les coupures soient
// identiques d'une session et d'un appareil à l'autre (condition de la déduplication).
const GEAR = (() => {
  const table = new Uint32Array(256);
  let seed = 0x52554348; // "RUCH"
  for (let i = 0; i < 256; i++) {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    table[i] = (t ^ (t >>> 14)) >>> 0;
  }
  return table;
})();

// Masques sur les bits de poids fort (ceux qui dépendent de la fenêtre la plus large).
const highMask = (bits: number) => (bits >= 32 ? 0xffffffff : ((1 << bits) - 1) << (32 - bits)) >>> 0;

/** Position de fin de l'alvéole qui commence à `start` (exclusive). */
export function cutPoint(buf: Uint8Array, start: number, end: number, p: ChunkParams): number {
  const size = end - start;
  if (size <= p.min) return end;
  const bits = Math.round(Math.log2(p.avg));
  const maskSmall = highMask(bits + 2); // plus strict avant la taille moyenne
  const maskLarge = highMask(bits - 2); // plus souple après
  const normal = start + Math.min(p.avg, size);
  const limit = start + Math.min(p.max, size);
  let h = 0;
  let i = start + p.min;
  for (; i < normal; i++) {
    h = ((h << 1) + GEAR[buf[i]]) >>> 0;
    if ((h & maskSmall) === 0) return i + 1;
  }
  for (; i < limit; i++) {
    h = ((h << 1) + GEAR[buf[i]]) >>> 0;
    if ((h & maskLarge) === 0) return i + 1;
  }
  return limit;
}

/** Découpe un Blob (même de plusieurs Go) en alvéoles, en le lisant par tranches. */
export async function* chunkBlob(blob: Blob, p: ChunkParams): AsyncGenerator<Uint8Array> {
  const SLICE = 8 * 1024 * 1024;
  let pending = new Uint8Array(0);
  let offset = 0;
  while (offset < blob.size || pending.length) {
    if (offset < blob.size && pending.length < p.max) {
      const next = new Uint8Array(await blob.slice(offset, offset + SLICE).arrayBuffer());
      offset += next.length;
      const merged = new Uint8Array(pending.length + next.length);
      merged.set(pending);
      merged.set(next, pending.length);
      pending = merged;
      continue;
    }
    const eof = offset >= blob.size;
    let start = 0;
    // On ne coupe que lorsque la fenêtre complète (max) est disponible, sauf en fin de fichier.
    while (pending.length - start >= p.max || (eof && start < pending.length)) {
      const end = cutPoint(pending, start, pending.length, p);
      yield pending.slice(start, end);
      start = end;
    }
    pending = pending.slice(start);
    if (eof) break;
  }
}
