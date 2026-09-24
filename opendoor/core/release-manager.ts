// SPDX-License-Identifier: GPL-2.0-only

export type ReleaseTargetState = 'pending' | 'ready' | 'failed' | 'disabled';

export type AngelRelease = {
  id: string;
  version: string;
  commit: string;
  checksum: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
  targets: Record<string, ReleaseTargetState>;
};

export class AngelReleaseManager {
  private readonly releases = new Map<string, AngelRelease>();
  private currentId: string | null = null;

  create(input: Omit<AngelRelease, 'id' | 'createdAt' | 'targets'> & { targets?: string[] }) {
    const id = `${input.version}-${input.commit.slice(0, 8)}-${Date.now().toString(36)}`;
    const release: AngelRelease = {
      ...input,
      id,
      createdAt: Date.now(),
      targets: Object.fromEntries((input.targets ?? []).map((target) => [target, 'pending' as const])),
    };
    this.releases.set(id, release);
    return release;
  }

  setTargetState(id: string, target: string, state: ReleaseTargetState) {
    const release = this.releases.get(id);
    if (!release) throw new Error(`Unknown release ${id}`);
    release.targets[target] = state;
    this.releases.set(id, { ...release, targets: { ...release.targets } });
    return this.releases.get(id)!;
  }

  promote(id: string) {
    const release = this.releases.get(id);
    if (!release) throw new Error(`Unknown release ${id}`);
    const states = Object.values(release.targets);
    if (states.length && !states.some((state) => state === 'ready')) throw new Error('Release has no ready target');
    this.currentId = id;
    return release;
  }

  current() { return this.currentId ? this.releases.get(this.currentId) ?? null : null; }
  get(id: string) { return this.releases.get(id) ?? null; }
  list() { return [...this.releases.values()].sort((a, b) => b.createdAt - a.createdAt); }
}
