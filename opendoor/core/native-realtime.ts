// SPDX-License-Identifier: GPL-2.0-only

export type RealtimeMessage<T = unknown> = {
  channel: string;
  payload: T;
  createdAt: number;
};

type Subscriber = (message: RealtimeMessage) => void;

type CacheEntry = {
  value: unknown;
  expiresAt?: number;
};

export class AngelNativeRealtimeCore {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly channels = new Map<string, Set<Subscriber>>();
  private readonly queues = new Map<string, unknown[]>();
  private readonly locks = new Map<string, number>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    this.cache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  publish<T>(channel: string, payload: T): void {
    const message: RealtimeMessage<T> = { channel, payload, createdAt: Date.now() };
    for (const subscriber of this.channels.get(channel) ?? []) subscriber(message);
  }

  subscribe(channel: string, subscriber: Subscriber): () => void {
    const subscribers = this.channels.get(channel) ?? new Set<Subscriber>();
    subscribers.add(subscriber);
    this.channels.set(channel, subscribers);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) this.channels.delete(channel);
    };
  }

  enqueue<T>(queue: string, value: T): number {
    const items = this.queues.get(queue) ?? [];
    items.push(value);
    this.queues.set(queue, items);
    return items.length;
  }

  dequeue<T>(queue: string): T | null {
    const items = this.queues.get(queue);
    if (!items?.length) return null;
    const value = items.shift() as T;
    if (!items.length) this.queues.delete(queue);
    return value;
  }

  acquireLock(key: string, ttlMs = 30_000): boolean {
    const now = Date.now();
    const until = this.locks.get(key);
    if (until && until > now) return false;
    this.locks.set(key, now + ttlMs);
    return true;
  }

  releaseLock(key: string): void {
    this.locks.delete(key);
  }
}
