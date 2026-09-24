// SPDX-License-Identifier: GPL-2.0-only

import type { AngelEventLog } from './event-log';
import type { AngelTelemetry } from './observability';

export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export type WorkflowStep<TContext = Record<string, unknown>> = {
  id: string;
  run: (context: TContext) => Promise<Partial<TContext> | void>;
  retries?: number;
  retryDelayMs?: number;
};

export type WorkflowSnapshot<TContext> = {
  id: string;
  name: string;
  status: WorkflowStatus;
  currentStep: number;
  context: TContext;
  attempts: Record<string, number>;
  lastError?: string;
  updatedAt: number;
};

export interface WorkflowStateStore {
  load<TContext>(id: string): Promise<WorkflowSnapshot<TContext> | null>;
  save<TContext>(snapshot: WorkflowSnapshot<TContext>): Promise<void>;
}

export class MemoryWorkflowStateStore implements WorkflowStateStore {
  private readonly states = new Map<string, WorkflowSnapshot<unknown>>();
  async load<TContext>(id: string) { return (this.states.get(id) as WorkflowSnapshot<TContext> | undefined) ?? null; }
  async save<TContext>(snapshot: WorkflowSnapshot<TContext>) { this.states.set(snapshot.id, snapshot as WorkflowSnapshot<unknown>); }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class DurableWorkflowEngine {
  constructor(
    private readonly store: WorkflowStateStore = new MemoryWorkflowStateStore(),
    private readonly eventLog?: AngelEventLog,
    private readonly telemetry?: AngelTelemetry,
  ) {}

  async run<TContext extends Record<string, unknown>>(
    id: string,
    name: string,
    initialContext: TContext,
    steps: WorkflowStep<TContext>[],
  ): Promise<WorkflowSnapshot<TContext>> {
    const existing = await this.store.load<TContext>(id);
    const snapshot: WorkflowSnapshot<TContext> = existing ?? {
      id,
      name,
      status: 'pending',
      currentStep: 0,
      context: initialContext,
      attempts: {},
      updatedAt: Date.now(),
    };

    if (snapshot.status === 'completed') return snapshot;
    snapshot.status = 'running';
    await this.store.save(snapshot);
    await this.eventLog?.append('workflow.started', { id, name, resumed: Boolean(existing), currentStep: snapshot.currentStep });

    for (let index = snapshot.currentStep; index < steps.length; index += 1) {
      const step = steps[index];
      const maxAttempts = Math.max(1, (step.retries ?? 0) + 1);
      let completed = false;

      while (!completed) {
        const attempt = (snapshot.attempts[step.id] ?? 0) + 1;
        snapshot.attempts[step.id] = attempt;
        snapshot.updatedAt = Date.now();
        await this.store.save(snapshot);
        const startedAt = Date.now();
        await this.eventLog?.append('workflow.step.started', { workflowId: id, stepId: step.id, attempt });

        try {
          const patch = await step.run(snapshot.context);
          if (patch) snapshot.context = { ...snapshot.context, ...patch };
          snapshot.currentStep = index + 1;
          snapshot.lastError = undefined;
          snapshot.updatedAt = Date.now();
          await this.store.save(snapshot);
          this.telemetry?.observe('workflow.step.duration_ms', Date.now() - startedAt, { workflow: name, step: step.id });
          this.telemetry?.increment('workflow.step.success', 1, { workflow: name, step: step.id });
          await this.eventLog?.append('workflow.step.completed', { workflowId: id, stepId: step.id, attempt });
          completed = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          snapshot.lastError = message;
          snapshot.updatedAt = Date.now();
          this.telemetry?.increment('workflow.step.failure', 1, { workflow: name, step: step.id });
          await this.eventLog?.append('workflow.step.failed', { workflowId: id, stepId: step.id, attempt, message });
          await this.store.save(snapshot);
          if (attempt >= maxAttempts) {
            snapshot.status = 'failed';
            await this.store.save(snapshot);
            await this.eventLog?.append('workflow.failed', { id, name, stepId: step.id, message });
            return snapshot;
          }
          await sleep(step.retryDelayMs ?? Math.min(30_000, 500 * 2 ** (attempt - 1)));
        }
      }
    }

    snapshot.status = 'completed';
    snapshot.updatedAt = Date.now();
    await this.store.save(snapshot);
    await this.eventLog?.append('workflow.completed', { id, name });
    this.telemetry?.increment('workflow.completed', 1, { workflow: name });
    return snapshot;
  }
}
