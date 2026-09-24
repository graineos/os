// SPDX-License-Identifier: GPL-2.0-only

export type QueueTask<T> = () => Promise<T>;

export type QueueOptions = {
  minDelayMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as Record<string, unknown>;
  const status = value.status ?? value.statusCode ?? value.code;
  if (typeof status === 'number') return status;
  if (typeof status === 'string' && /^\d{3}$/.test(status)) return Number(status);
  return undefined;
}

function shouldRetry(error: unknown) {
  const status = getStatus(error);
  if (status === 429) return true;
  if (status && status >= 500 && status < 600) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /too many requests|rate limit|temporarily unavailable|timeout/i.test(message);
}

export class RequestQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private readonly options: Required<QueueOptions>;

  constructor(options: QueueOptions = {}) {
    this.options = {
      minDelayMs: options.minDelayMs ?? 800,
      maxRetries: options.maxRetries ?? 5,
      baseBackoffMs: options.baseBackoffMs ?? 1_500,
      maxBackoffMs: options.maxBackoffMs ?? 60_000,
    };
  }

  enqueue<T>(task: QueueTask<T>): Promise<T> {
    const run = async () => {
      await sleep(this.options.minDelayMs);
      let attempt = 0;
      while (true) {
        try {
          return await task();
        } catch (error) {
          if (!shouldRetry(error) || attempt >= this.options.maxRetries) throw error;
          const exponential = this.options.baseBackoffMs * 2 ** attempt;
          const jitter = Math.floor(Math.random() * 500);
          await sleep(Math.min(this.options.maxBackoffMs, exponential + jitter));
          attempt += 1;
        }
      }
    };

    const next = this.chain.then(run, run);
    this.chain = next.then(() => undefined, () => undefined);
    return next;
  }
}

export const externalRequestQueue = new RequestQueue();
