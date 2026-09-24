// SPDX-License-Identifier: GPL-2.0-only

import type { AngelLayer } from './system-contract';
import type { AngelIssueRegistry } from './issue-registry';

export type AngelApplication = {
  id: string;
  name: string;
  version: string;
  layer: Extract<AngelLayer, 'angel-os-ia' | 'application'>;
  requires: string[];
  provides: string[];
  health?: () => Promise<boolean>;
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
};

export type AngelApplicationState = 'registered' | 'starting' | 'running' | 'degraded' | 'stopped' | 'failed';

export class AngelApplicationRuntime {
  private readonly apps = new Map<string, AngelApplication>();
  private readonly states = new Map<string, AngelApplicationState>();

  constructor(private readonly issueRegistry?: AngelIssueRegistry) {}

  register(app: AngelApplication) {
    if (this.apps.has(app.id)) throw new Error(`Application already registered: ${app.id}`);
    this.apps.set(app.id, app);
    this.states.set(app.id, 'registered');
    return app;
  }

  async start(id: string) {
    const app = this.apps.get(id);
    if (!app) throw new Error(`Unknown application: ${id}`);
    this.states.set(id, 'starting');
    try {
      await app.start?.();
      const healthy = app.health ? await app.health() : true;
      this.states.set(id, healthy ? 'running' : 'degraded');
      if (!healthy) {
        await this.issueRegistry?.report({
          title: `${app.name} is degraded after startup`,
          type: 'application-health',
          priority: app.layer === 'angel-os-ia' ? 'P1' : 'P2',
          evidence: { source: 'application-runtime', component: app.id, message: 'Health check returned false' },
        });
      }
    } catch (error) {
      this.states.set(id, 'failed');
      await this.issueRegistry?.report({
        title: `${app.name} failed to start`,
        type: 'application-start-failure',
        priority: 'P1',
        evidence: {
          source: 'application-runtime',
          component: app.id,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      throw error;
    }
    return this.snapshot(id);
  }

  async stop(id: string) {
    const app = this.apps.get(id);
    if (!app) throw new Error(`Unknown application: ${id}`);
    await app.stop?.();
    this.states.set(id, 'stopped');
    return this.snapshot(id);
  }

  async checkHealth(id: string) {
    const app = this.apps.get(id);
    if (!app) throw new Error(`Unknown application: ${id}`);
    try {
      const healthy = app.health ? await app.health() : true;
      this.states.set(id, healthy ? 'running' : 'degraded');
      if (!healthy) {
        await this.issueRegistry?.report({
          title: `${app.name} health check failed`,
          type: 'application-health',
          priority: app.layer === 'angel-os-ia' ? 'P1' : 'P2',
          evidence: { source: 'application-runtime', component: app.id, message: 'Health check returned false' },
        });
      }
      return healthy;
    } catch (error) {
      this.states.set(id, 'failed');
      await this.issueRegistry?.report({
        title: `${app.name} health check crashed`,
        type: 'application-health-error',
        priority: 'P1',
        evidence: {
          source: 'application-runtime',
          component: app.id,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      return false;
    }
  }

  snapshot(id: string) {
    const app = this.apps.get(id);
    if (!app) return null;
    return { ...app, state: this.states.get(id) ?? 'registered' };
  }

  list() { return [...this.apps.keys()].map((id) => this.snapshot(id)!).filter(Boolean); }
}
