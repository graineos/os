// SPDX-License-Identifier: GPL-2.0-only

export type SyncRecord<T = unknown> = {
  key: string;
  source: string;
  version: number;
  updatedAt: number;
  value: T;
  checksum?: string;
};

export type SyncConflict<T = unknown> = { current: SyncRecord<T>; incoming: SyncRecord<T> };

export class AngelSyncEngine {
  private readonly records = new Map<string, SyncRecord>();

  apply<T>(incoming: SyncRecord<T>, resolve?: (conflict: SyncConflict<T>) => SyncRecord<T>) {
    const current = this.records.get(incoming.key) as SyncRecord<T> | undefined;
    if (!current || incoming.version > current.version || (incoming.version === current.version && incoming.updatedAt > current.updatedAt)) {
      this.records.set(incoming.key, incoming);
      return { status: 'applied' as const, record: incoming };
    }
    if (incoming.version === current.version && incoming.updatedAt === current.updatedAt && incoming.checksum === current.checksum) {
      return { status: 'duplicate' as const, record: current };
    }
    if (resolve) {
      const resolved = resolve({ current, incoming });
      this.records.set(incoming.key, resolved);
      return { status: 'resolved' as const, record: resolved };
    }
    return { status: 'conflict' as const, record: current, conflict: { current, incoming } };
  }

  get<T>(key: string) { return (this.records.get(key) as SyncRecord<T> | undefined) ?? null; }
  list() { return [...this.records.values()]; }
}
