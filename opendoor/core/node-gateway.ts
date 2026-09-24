// SPDX-License-Identifier: GPL-2.0-only

export type AngelNodeState = 'healthy' | 'degraded' | 'offline' | 'unknown';

export type AngelNode = {
  id: string;
  kind: 'vercel' | 'angel-node' | 'worker' | 'other';
  endpoint?: string;
  priority: number;
  state: AngelNodeState;
  latencyMs?: number;
  releaseId?: string;
  updatedAt: number;
  metadata?: Record<string, unknown>;
};

export class AngelNodeGateway {
  private readonly nodes = new Map<string, AngelNode>();

  upsert(input: Omit<AngelNode, 'updatedAt'> & { updatedAt?: number }) {
    const node: AngelNode = { ...input, updatedAt: input.updatedAt ?? Date.now() };
    this.nodes.set(node.id, node);
    return node;
  }

  mark(id: string, state: AngelNodeState, patch: Partial<Pick<AngelNode, 'latencyMs' | 'releaseId' | 'metadata'>> = {}) {
    const previous = this.nodes.get(id);
    if (!previous) throw new Error(`Unknown node ${id}`);
    const next = { ...previous, ...patch, state, updatedAt: Date.now() };
    this.nodes.set(id, next);
    return next;
  }

  rank() {
    const stateWeight: Record<AngelNodeState, number> = { healthy: 1000, degraded: 100, unknown: 10, offline: -10000 };
    return [...this.nodes.values()].sort((a, b) => {
      const aScore = stateWeight[a.state] + a.priority * 10 - Math.min(a.latencyMs ?? 0, 5000) / 100;
      const bScore = stateWeight[b.state] + b.priority * 10 - Math.min(b.latencyMs ?? 0, 5000) / 100;
      return bScore - aScore;
    });
  }

  select() { return this.rank().find((node) => node.state !== 'offline') ?? null; }
  list() { return [...this.nodes.values()]; }
}
