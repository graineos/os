// SPDX-License-Identifier: GPL-2.0-only

import type { KeyValueCache, TaskWorker } from './service-adapters';

export interface NativeRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface NativeCollectionStore {
  list<T extends NativeRecord>(collection: string): Promise<T[]>;
  get<T extends NativeRecord>(collection: string, id: string): Promise<T | null>;
  put<T extends NativeRecord>(collection: string, value: T): Promise<T>;
  delete(collection: string, id: string): Promise<void>;
}

/**
 * Browser-native durable store. It provides a zero-connection persistence layer
 * for private/offline Angel OS features. Server/shared data can continue using
 * the existing provider until an automatically provisioned SQL service exists.
 */
export class IndexedDbCollectionStore implements NativeCollectionStore {
  private readonly databaseName: string;
  private readonly storeName = 'records';

  constructor(databaseName = 'angel-os-native-v1') {
    this.databaseName = databaseName;
  }

  private open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is unavailable in this runtime'));
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('collection', 'collection', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
    });
  }

  private async transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const request = run(tx.objectStore(this.storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB operation failed'));
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  async list<T extends NativeRecord>(collection: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const index = tx.objectStore(this.storeName).index('collection');
      const request = index.getAll(IDBKeyRange.only(collection));
      request.onsuccess = () => resolve(request.result.map((entry: any) => entry.value as T));
      request.onerror = () => reject(request.error ?? new Error('IndexedDB list failed'));
      tx.oncomplete = () => db.close();
    });
  }

  async get<T extends NativeRecord>(collection: string, id: string): Promise<T | null> {
    const result = await this.transaction<any>('readonly', (store) => store.get(`${collection}:${id}`));
    return result?.value ?? null;
  }

  async put<T extends NativeRecord>(collection: string, value: T): Promise<T> {
    await this.transaction<IDBValidKey>('readwrite', (store) => store.put({
      key: `${collection}:${value.id}`,
      collection,
      value,
    }));
    return value;
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.transaction<undefined>('readwrite', (store) => store.delete(`${collection}:${id}`) as IDBRequest<undefined>);
  }
}

export type NativeTaskHandler<TInput = unknown, TOutput = unknown> = (input: TInput) => Promise<TOutput> | TOutput;

/**
 * In-process worker: same orchestration concept as a Python/Rust worker, with no
 * external process or connection required. Heavy tasks can later be delegated
 * to Python or Rust behind the same TaskWorker interface.
 */
export class NativeTaskWorker implements TaskWorker {
  readonly name = 'angel-native-worker';
  private readonly handlers = new Map<string, NativeTaskHandler>();

  register<TInput = unknown, TOutput = unknown>(task: string, handler: NativeTaskHandler<TInput, TOutput>): this {
    this.handlers.set(task, handler as NativeTaskHandler);
    return this;
  }

  async health(): Promise<boolean> {
    return true;
  }

  async run<TInput = unknown, TOutput = unknown>(task: string, input: TInput): Promise<TOutput> {
    const handler = this.handlers.get(task);
    if (!handler) throw new Error(`Unknown Angel Native task: ${task}`);
    return handler(input) as Promise<TOutput>;
  }
}

export class NamespacedCache implements KeyValueCache {
  constructor(private readonly inner: KeyValueCache, private readonly namespace: string) {}

  private key(key: string) {
    return `${this.namespace}:${key}`;
  }

  get<T>(key: string): Promise<T | null> {
    return this.inner.get<T>(this.key(key));
  }

  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    return this.inner.set(this.key(key), value, ttlSeconds);
  }

  delete(key: string): Promise<void> {
    return this.inner.delete(this.key(key));
  }
}
