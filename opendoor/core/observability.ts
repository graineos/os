// SPDX-License-Identifier: GPL-2.0-only

export type MetricPoint = { name: string; value: number; at: number; labels?: Record<string, string> };

export class AngelTelemetry {
  private counters = new Map<string, number>();
  private points: MetricPoint[] = [];

  increment(name: string, value = 1, labels?: Record<string, string>) {
    const key = `${name}:${JSON.stringify(labels ?? {})}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
    this.points.push({ name, value, at: Date.now(), labels });
  }

  observe(name: string, value: number, labels?: Record<string, string>) {
    this.points.push({ name, value, at: Date.now(), labels });
    if (this.points.length > 5000) this.points.splice(0, this.points.length - 5000);
  }

  snapshot() {
    return { counters: Object.fromEntries(this.counters), points: [...this.points] };
  }
}
