// SPDX-License-Identifier: GPL-2.0-only

export type MemoryKind = 'personal' | 'operational' | 'technical' | 'document' | 'temporal' | string;
export type MemoryVisibility = 'private' | 'public' | 'system';

export type MemoryDocument = {
  id: string;
  source: string;
  title: string;
  text: string;
  tags?: string[];
  updatedAt: number;
  kind?: MemoryKind;
  visibility?: MemoryVisibility;
  confidence?: number;
  expiresAt?: number | null;
  metadata?: Record<string, unknown>;
};

export type MemoryHit = MemoryDocument & { score: number; stale: boolean };

function tokens(input: string) {
  return input.toLocaleLowerCase('fr-FR').normalize('NFD').replace(/\p{Diacritic}/gu, '').split(/[^a-z0-9]+/).filter((token) => token.length > 1);
}

function confidenceOf(document: MemoryDocument) {
  if (typeof document.confidence !== 'number') return 1;
  return Math.max(0, Math.min(1, document.confidence));
}

export class AngelMemoryIndex {
  private docs = new Map<string, MemoryDocument>();

  upsert(document: MemoryDocument) {
    this.docs.set(document.id, {
      ...document,
      confidence: confidenceOf(document),
      visibility: document.visibility ?? 'private',
      kind: document.kind ?? 'document',
    });
  }

  remove(id: string) {
    this.docs.delete(id);
  }

  get(id: string, options: { includeExpired?: boolean } = {}) {
    const document = this.docs.get(id) ?? null;
    if (!document) return null;
    if (!options.includeExpired && document.expiresAt && document.expiresAt <= Date.now()) return null;
    return document;
  }

  search(query: string, limit = 20, options: {
    visibility?: MemoryVisibility | MemoryVisibility[];
    kinds?: MemoryKind[];
    includeExpired?: boolean;
  } = {}): MemoryHit[] {
    const queryTokens = new Set(tokens(query));
    if (!queryTokens.size) return [];
    const now = Date.now();
    const visibility = options.visibility
      ? new Set(Array.isArray(options.visibility) ? options.visibility : [options.visibility])
      : null;
    const kinds = options.kinds ? new Set(options.kinds) : null;

    return [...this.docs.values()]
      .filter((doc) => !visibility || visibility.has(doc.visibility ?? 'private'))
      .filter((doc) => !kinds || kinds.has(doc.kind ?? 'document'))
      .map((doc) => {
        const stale = Boolean(doc.expiresAt && doc.expiresAt <= now);
        if (stale && !options.includeExpired) return null;
        const titleTokens = tokens(doc.title);
        const bodyTokens = tokens(doc.text);
        const tagTokens = tokens((doc.tags ?? []).join(' '));
        let score = 0;
        for (const token of queryTokens) {
          if (titleTokens.includes(token)) score += 8;
          score += bodyTokens.filter((value) => value === token).length * 2;
          if (tagTokens.includes(token)) score += 5;
        }
        const ageDays = Math.max(0, (now - doc.updatedAt) / 86_400_000);
        score += Math.max(0, 3 - ageDays / 30);
        score *= confidenceOf(doc);
        if (stale) score *= 0.2;
        return { ...doc, score, stale };
      })
      .filter((hit): hit is MemoryHit => Boolean(hit && hit.score > 0))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  purgeExpired(now = Date.now()) {
    let removed = 0;
    for (const [id, doc] of this.docs) {
      if (doc.expiresAt && doc.expiresAt <= now) {
        this.docs.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  stats() {
    const now = Date.now();
    const bySource: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    const byVisibility: Record<string, number> = {};
    let expired = 0;
    for (const doc of this.docs.values()) {
      bySource[doc.source] = (bySource[doc.source] ?? 0) + 1;
      const kind = doc.kind ?? 'document';
      const visibility = doc.visibility ?? 'private';
      byKind[kind] = (byKind[kind] ?? 0) + 1;
      byVisibility[visibility] = (byVisibility[visibility] ?? 0) + 1;
      if (doc.expiresAt && doc.expiresAt <= now) expired += 1;
    }
    return { total: this.docs.size, expired, bySource, byKind, byVisibility };
  }
}
