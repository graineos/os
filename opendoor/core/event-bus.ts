// SPDX-License-Identifier: GPL-2.0-only

type Listener<T = unknown> = (payload: T) => void | Promise<void>;

export class OpenDoorOSEventBus {
  private listeners = new Map<string, Set<Listener>>();

  on<T>(event: string, listener: Listener<T>): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener as Listener);
    this.listeners.set(event, set);
    return () => this.off(event, listener);
  }

  off<T>(event: string, listener: Listener<T>): void {
    const set = this.listeners.get(event);
    set?.delete(listener as Listener);
    if (set?.size === 0) this.listeners.delete(event);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const set = this.listeners.get(event);
    if (!set) return;
    await Promise.all([...set].map((listener) => listener(payload)));
  }

  clear(): void {
    this.listeners.clear();
  }
}
