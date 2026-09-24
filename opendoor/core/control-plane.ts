// SPDX-License-Identifier: GPL-2.0-only

export type HealthState = 'healthy' | 'degraded' | 'down' | 'unknown';

export type HealthEvidence = {
  checkedAt: number;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
};

export type HealthProbeResult = {
  state: HealthState;
  evidence: HealthEvidence;
};

export type HealthProbe = {
  id: string;
  label: string;
  critical?: boolean;
  run: () => Promise<HealthProbeResult>;
  recover?: (result: HealthProbeResult) => Promise<HealthProbeResult>;
};

export type ControlPlaneSnapshot = {
  generatedAt: number;
  state: HealthState;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
  probes: Array<{
    id: string;
    label: string;
    critical: boolean;
    result: HealthProbeResult;
    recoveryAttempted: boolean;
  }>;
};

function overallState(results: ControlPlaneSnapshot['probes']): HealthState {
  if (results.some((entry) => entry.critical && entry.result.state === 'down')) return 'down';
  if (results.some((entry) => entry.result.state === 'down' || entry.result.state === 'degraded')) return 'degraded';
  if (results.some((entry) => entry.result.state === 'unknown')) return 'unknown';
  return 'healthy';
}

export class AngelControlPlane {
  private readonly probes = new Map<string, HealthProbe>();
  private lastSnapshot: ControlPlaneSnapshot | null = null;

  register(probe: HealthProbe): this {
    this.probes.set(probe.id, probe);
    return this;
  }

  remove(id: string) {
    this.probes.delete(id);
  }

  snapshot() {
    return this.lastSnapshot;
  }

  async inspect(options: { autoRecover?: boolean } = {}): Promise<ControlPlaneSnapshot> {
    const reports: ControlPlaneSnapshot['probes'] = [];

    for (const probe of this.probes.values()) {
      let result: HealthProbeResult;
      try {
        result = await probe.run();
      } catch (error) {
        result = {
          state: 'down',
          evidence: {
            checkedAt: Date.now(),
            message: error instanceof Error ? error.message : 'Health probe failed',
          },
        };
      }

      let recoveryAttempted = false;
      if (options.autoRecover && probe.recover && (result.state === 'down' || result.state === 'degraded')) {
        recoveryAttempted = true;
        try {
          result = await probe.recover(result);
        } catch (error) {
          result = {
            state: 'down',
            evidence: {
              checkedAt: Date.now(),
              message: error instanceof Error ? error.message : 'Recovery failed',
              details: { previous: result },
            },
          };
        }
      }

      reports.push({
        id: probe.id,
        label: probe.label,
        critical: Boolean(probe.critical),
        result,
        recoveryAttempted,
      });
    }

    const count = (state: HealthState) => reports.filter((entry) => entry.result.state === state).length;
    this.lastSnapshot = {
      generatedAt: Date.now(),
      state: overallState(reports),
      healthy: count('healthy'),
      degraded: count('degraded'),
      down: count('down'),
      unknown: count('unknown'),
      probes: reports,
    };
    return this.lastSnapshot;
  }
}

export async function timedProbe(fn: () => Promise<void>): Promise<HealthProbeResult> {
  const started = performance.now();
  await fn();
  return {
    state: 'healthy',
    evidence: {
      checkedAt: Date.now(),
      latencyMs: Math.round(performance.now() - started),
    },
  };
}
