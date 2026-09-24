// SPDX-License-Identifier: GPL-2.0-only

export interface KeyValueCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface RelationalStore {
  health(): Promise<boolean>;
  query<T = unknown>(statement: string, params?: unknown[]): Promise<T[]>;
}

export interface TaskWorker {
  name: string;
  health(): Promise<boolean>;
  run<TInput = unknown, TOutput = unknown>(task: string, input: TInput): Promise<TOutput>;
}

export class MemoryCache implements KeyValueCache {
  private readonly values = new Map<string, { value: unknown; expiresAt?: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

/**
 * Runtime services always expose a working cache. External services are attached
 * only after a successful health check, so Redis/MySQL/Python/Rust can remain
 * optional without breaking Angel OS.
 */
export type AngelRuntimeServices = {
  cache: KeyValueCache;
  database?: RelationalStore;
  workers: TaskWorker[];
};

export function createFallbackRuntimeServices(): AngelRuntimeServices {
  return {
    cache: new MemoryCache(),
    workers: [],
  };
}
