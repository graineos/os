// SPDX-License-Identifier: GPL-2.0-only

export type AngelEvent = {
  id: string;
  type: string;
  at: number;
  payload: unknown;
};

export class AngelEventLog {
  private events: AngelEvent[] = [];
  constructor(private readonly maxEvents = 5000) {}

  async append(type: string, payload: unknown): Promise<AngelEvent> {
    const event: AngelEvent = { id: crypto.randomUUID(), type, at: Date.now(), payload };
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    return event;
  }

  list(filter?: { type?: string; since?: number; limit?: number }) {
    let output = this.events;
    if (filter?.type) output = output.filter((event) => event.type === filter.type);
    if (filter?.since) output = output.filter((event) => event.at >= filter.since!);
    return output.slice(-(filter?.limit ?? 200));
  }

  snapshot() {
    return [...this.events];
  }
}
