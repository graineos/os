// SPDX-License-Identifier: GPL-2.0-only

import type { AngelEventLog } from './event-log';
import type { AngelTelemetry } from './observability';
import type { AngelRelease, AngelReleaseManager } from './release-manager';

export type DeployTarget = {
  id: string;
  kind: 'vercel' | 'angel-node' | 'other';
  health: () => Promise<boolean>;
  deploy: (release: AngelRelease) => Promise<{ ok: boolean; url?: string; detail?: string }>;
};

export type DeployReport = {
  releaseId: string;
  results: Array<{ targetId: string; ok: boolean; url?: string; detail?: string }>;
  readyTargets: string[];
};

export class AngelDeployEngine {
  constructor(
    private readonly releases: AngelReleaseManager,
    private readonly eventLog?: AngelEventLog,
    private readonly telemetry?: AngelTelemetry,
  ) {}

  async deploy(release: AngelRelease, targets: DeployTarget[]): Promise<DeployReport> {
    const results: DeployReport['results'] = [];
    for (const target of targets) {
      const startedAt = Date.now();
      try {
        const healthy = await target.health();
        if (!healthy) {
          this.releases.setTargetState(release.id, target.id, 'failed');
          results.push({ targetId: target.id, ok: false, detail: 'target unhealthy' });
          await this.eventLog?.append('deploy.target.skipped', { releaseId: release.id, targetId: target.id, reason: 'unhealthy' });
          continue;
        }
        const result = await target.deploy(release);
        this.releases.setTargetState(release.id, target.id, result.ok ? 'ready' : 'failed');
        results.push({ targetId: target.id, ...result });
        this.telemetry?.observe('deploy.target.duration_ms', Date.now() - startedAt, { target: target.id, kind: target.kind });
        this.telemetry?.increment(result.ok ? 'deploy.target.success' : 'deploy.target.failure', 1, { target: target.id, kind: target.kind });
        await this.eventLog?.append(result.ok ? 'deploy.target.ready' : 'deploy.target.failed', { releaseId: release.id, targetId: target.id, result });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.releases.setTargetState(release.id, target.id, 'failed');
        results.push({ targetId: target.id, ok: false, detail });
        this.telemetry?.increment('deploy.target.failure', 1, { target: target.id, kind: target.kind });
        await this.eventLog?.append('deploy.target.failed', { releaseId: release.id, targetId: target.id, detail });
      }
    }
    const readyTargets = results.filter((result) => result.ok).map((result) => result.targetId);
    if (readyTargets.length) this.releases.promote(release.id);
    return { releaseId: release.id, results, readyTargets };
  }
}
