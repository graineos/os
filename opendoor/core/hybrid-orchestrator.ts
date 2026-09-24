// SPDX-License-Identifier: GPL-2.0-only

import type { KeyValueCache, TaskWorker } from './service-adapters';
import type { AngelEventLog } from './event-log';
import type { AngelTelemetry } from './observability';

export type HybridProvider<TInput = unknown, TOutput = unknown> = {
  id: string;
  kind: 'external' | 'native';
  priority?: number;
  costWeight?: number;
  health?: () => Promise<boolean>;
  run: (input: TInput) => Promise<TOutput>;
};

export type HybridStrategy = 'race' | 'cascade' | 'merge' | 'adaptive';

export type HybridRunOptions<TOutput> = {
  strategy?: HybridStrategy;
  cacheKey?: string;
  cacheTtlSeconds?: number;
  merge?: (results: TOutput[]) => TOutput;
  validate?: (result: TOutput) => boolean;
};

export type HybridRunReport<TOutput> = {
  result: TOutput;
  providerIds: string[];
  usedNative: boolean;
  usedExternal: boolean;
  fromCache: boolean;
  failures: Array<{ providerId: string; message: string }>;
};

type ProviderStats = {
  successes: number;
  failures: number;
  totalLatencyMs: number;
  lastLatencyMs?: number;
  lastUsedAt?: number;
};

function sortedProviders<TInput, TOutput>(providers: HybridProvider<TInput, TOutput>[]) {
  return [...providers].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export class HybridOrchestrator {
  private readonly providerStats = new Map<string, ProviderStats>();

  constructor(
    private readonly cache: KeyValueCache,
    private readonly workers: TaskWorker[] = [],
    private readonly eventLog?: AngelEventLog,
    private readonly telemetry?: AngelTelemetry,
  ) {}

  private async isHealthy<TInput, TOutput>(provider: HybridProvider<TInput, TOutput>) {
    if (!provider.health) return true;
    try {
      return await provider.health();
    } catch {
      return false;
    }
  }

  private scoreProvider<TInput, TOutput>(provider: HybridProvider<TInput, TOutput>) {
    const stats = this.providerStats.get(provider.id);
    if (!stats) return (provider.priority ?? 0) * 10 + (provider.kind === 'native' ? 1 : 0);
    const attempts = stats.successes + stats.failures;
    const reliability = attempts ? stats.successes / attempts : 1;
    const averageLatency = stats.successes ? stats.totalLatencyMs / stats.successes : 5000;
    const latencyScore = Math.max(0, 1000 - Math.min(1000, averageLatency)) / 100;
    const priorityScore = (provider.priority ?? 0) * 10;
    const costPenalty = (provider.costWeight ?? 0) * 5;
    return priorityScore + reliability * 100 + latencyScore - costPenalty;
  }

  private adaptiveProviders<TInput, TOutput>(providers: HybridProvider<TInput, TOutput>[]) {
    return [...providers].sort((a, b) => this.scoreProvider(b) - this.scoreProvider(a));
  }

  private async executeProvider<TInput, TOutput>(
    provider: HybridProvider<TInput, TOutput>,
    input: TInput,
    validate?: (result: TOutput) => boolean,
  ) {
    const startedAt = performance.now();
    try {
      const value = await provider.run(input);
      if (validate && !validate(value)) throw new Error('Result rejected by validator');
      const latencyMs = performance.now() - startedAt;
      const previous = this.providerStats.get(provider.id) ?? { successes: 0, failures: 0, totalLatencyMs: 0 };
      this.providerStats.set(provider.id, {
        ...previous,
        successes: previous.successes + 1,
        totalLatencyMs: previous.totalLatencyMs + latencyMs,
        lastLatencyMs: latencyMs,
        lastUsedAt: Date.now(),
      });
      this.telemetry?.observe('hybrid.provider.latency_ms', latencyMs, { provider: provider.id, kind: provider.kind });
      this.telemetry?.increment('hybrid.provider.success', 1, { provider: provider.id, kind: provider.kind });
      await this.eventLog?.append('hybrid.provider.succeeded', { providerId: provider.id, kind: provider.kind, latencyMs });
      return value;
    } catch (error) {
      const previous = this.providerStats.get(provider.id) ?? { successes: 0, failures: 0, totalLatencyMs: 0 };
      this.providerStats.set(provider.id, { ...previous, failures: previous.failures + 1, lastUsedAt: Date.now() });
      this.telemetry?.increment('hybrid.provider.failure', 1, { provider: provider.id, kind: provider.kind });
      await this.eventLog?.append('hybrid.provider.failed', { providerId: provider.id, kind: provider.kind, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  getProviderStats() {
    return [...this.providerStats.entries()].map(([providerId, stats]) => ({ providerId, ...stats }));
  }

  async run<TInput, TOutput>(
    input: TInput,
    providers: HybridProvider<TInput, TOutput>[],
    options: HybridRunOptions<TOutput> = {},
  ): Promise<HybridRunReport<TOutput>> {
    const strategy = options.strategy ?? 'adaptive';
    const failures: Array<{ providerId: string; message: string }> = [];

    if (options.cacheKey) {
      const cached = await this.cache.get<TOutput>(options.cacheKey);
      if (cached !== null) {
        this.telemetry?.increment('hybrid.cache.hit');
        await this.eventLog?.append('hybrid.cache.hit', { cacheKey: options.cacheKey });
        return {
          result: cached,
          providerIds: ['cache'],
          usedNative: true,
          usedExternal: false,
          fromCache: true,
          failures,
        };
      }
      this.telemetry?.increment('hybrid.cache.miss');
    }

    const candidates = strategy === 'adaptive' ? this.adaptiveProviders(providers) : sortedProviders(providers);
    const healthy: HybridProvider<TInput, TOutput>[] = [];
    for (const provider of candidates) {
      if (await this.isHealthy(provider)) healthy.push(provider);
    }

    if (!healthy.length) throw new Error('No healthy provider available');

    let result: TOutput;
    let used: HybridProvider<TInput, TOutput>[] = [];

    if (strategy === 'race') {
      const wrapped = healthy.map(async (provider) => {
        try {
          const value = await this.executeProvider(provider, input, options.validate);
          return { provider, value };
        } catch (error) {
          failures.push({ providerId: provider.id, message: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      });
      const winner = await Promise.any(wrapped);
      result = winner.value;
      used = [winner.provider];
    } else if (strategy === 'merge') {
      const successful: Array<{ provider: HybridProvider<TInput, TOutput>; value: TOutput }> = [];
      await Promise.all(healthy.map(async (provider) => {
        try {
          successful.push({ provider, value: await this.executeProvider(provider, input, options.validate) });
        } catch (error) {
          failures.push({ providerId: provider.id, message: error instanceof Error ? error.message : String(error) });
        }
      }));
      if (!successful.length) throw new Error('All hybrid providers failed');
      used = successful.map((entry) => entry.provider);
      result = options.merge ? options.merge(successful.map((entry) => entry.value)) : successful[0].value;
    } else {
      let selected: { provider: HybridProvider<TInput, TOutput>; value: TOutput } | null = null;
      for (const provider of healthy) {
        try {
          selected = { provider, value: await this.executeProvider(provider, input, options.validate) };
          break;
        } catch (error) {
          failures.push({ providerId: provider.id, message: error instanceof Error ? error.message : String(error) });
        }
      }
      if (!selected) throw new Error('All hybrid providers failed');
      used = [selected.provider];
      result = selected.value;
    }

    if (options.cacheKey) await this.cache.set(options.cacheKey, result, options.cacheTtlSeconds);

    return {
      result,
      providerIds: used.map((provider) => provider.id),
      usedNative: used.some((provider) => provider.kind === 'native'),
      usedExternal: used.some((provider) => provider.kind === 'external'),
      fromCache: false,
      failures,
    };
  }

  async enrich<TInput, TOutput>(task: string, input: TInput): Promise<TOutput[]> {
    const outputs: TOutput[] = [];
    for (const worker of this.workers) {
      try {
        if (await worker.health()) outputs.push(await worker.run<TInput, TOutput>(task, input));
      } catch {
        this.telemetry?.increment('hybrid.worker.failure', 1, { worker: worker.name, task });
      }
    }
    return outputs;
  }
}
