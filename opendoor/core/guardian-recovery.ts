// SPDX-License-Identifier: GPL-2.0-only

import type { AngelEventLog } from './event-log';
import type { AngelTelemetry } from './observability';
import type { AngelIssueRegistry, IssueJsonValue, IssuePriority } from './issue-registry';

export type GuardianSeverity = 'info' | 'warning' | 'critical';
export type GuardianFinding = {
  id: string;
  type: string;
  severity: GuardianSeverity;
  message: string;
  at: number;
  data?: { [key: string]: IssueJsonValue };
};

export type RecoveryAction = 'retry' | 'fallback' | 'rollback' | 'resync' | 'invalidate-cache' | 'isolate-provider' | 'restore-checkpoint' | 'none';

function priorityForSeverity(severity: GuardianSeverity): IssuePriority {
  if (severity === 'critical') return 'P1';
  if (severity === 'warning') return 'P2';
  return 'P3';
}

export class AngelGuardian {
  private findings: GuardianFinding[] = [];
  constructor(
    private readonly eventLog?: AngelEventLog,
    private readonly telemetry?: AngelTelemetry,
    private readonly issueRegistry?: AngelIssueRegistry,
  ) {}

  async report(input: Omit<GuardianFinding, 'id' | 'at'>) {
    const finding: GuardianFinding = { ...input, id: crypto.randomUUID(), at: Date.now() };
    this.findings.push(finding);
    if (this.findings.length > 2000) this.findings.splice(0, this.findings.length - 2000);
    this.telemetry?.increment('guardian.finding', 1, { severity: finding.severity, type: finding.type });
    await this.eventLog?.append('guardian.finding', finding);
    await this.issueRegistry?.report({
      title: finding.message,
      type: finding.type,
      priority: priorityForSeverity(finding.severity),
      evidence: {
        source: 'guardian',
        message: finding.message,
        data: finding.data,
      },
    });
    return finding;
  }

  active(limit = 100) { return this.findings.slice(-limit); }
  clear(id: string) { this.findings = this.findings.filter((finding) => finding.id !== id); }
}

export class AngelRecovery {
  decide(finding: GuardianFinding): RecoveryAction {
    if (/cache/i.test(finding.type)) return 'invalidate-cache';
    if (/sync|stale|snapshot/i.test(finding.type)) return 'resync';
    if (/provider|api|ai/i.test(finding.type)) return finding.severity === 'critical' ? 'isolate-provider' : 'fallback';
    if (/release|deploy|build/i.test(finding.type)) return finding.severity === 'critical' ? 'rollback' : 'retry';
    if (/workflow|checkpoint/i.test(finding.type)) return 'restore-checkpoint';
    return finding.severity === 'critical' ? 'fallback' : 'none';
  }
}