// SPDX-License-Identifier: GPL-2.0-only

import type { AngelEventLog } from './event-log';
import type { AngelTelemetry } from './observability';
import type { KeyValueCache } from './service-adapters';

export type IssuePriority = 'P0' | 'P1' | 'P2' | 'P3';
export type IssueStatus = 'detected' | 'triaged' | 'repairing' | 'fixed' | 'verified' | 'ignored';
export type IssueJsonValue = string | number | boolean | null | IssueJsonValue[] | { [key: string]: IssueJsonValue };

export type IssueEvidence = {
  source?: string;
  route?: string;
  component?: string;
  message?: string;
  stack?: string;
  data?: { [key: string]: IssueJsonValue };
};

export type AngelIssue = {
  id: string;
  fingerprint: string;
  title: string;
  type: string;
  priority: IssuePriority;
  status: IssueStatus;
  firstSeenAt: number;
  lastSeenAt: number;
  occurrences: number;
  evidence: IssueEvidence[];
  suspectedCause?: string;
  affectedFiles?: string[];
  repairNotes?: string[];
  fixCommit?: string;
  verifiedAt?: number;
  productionVerified?: boolean;
};

export type ReportIssueInput = {
  title: string;
  type: string;
  priority?: IssuePriority;
  fingerprint?: string;
  evidence?: IssueEvidence;
  suspectedCause?: string;
  affectedFiles?: string[];
};

const STORE_KEY = 'angel-os:issue-registry:v1';

function normalize(value: string) {
  return value.toLowerCase().replace(/[0-9a-f]{7,64}/g, '<sha>').replace(/\d+/g, '<n>').replace(/\s+/g, ' ').trim();
}

function hash(input: string) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return `issue-${(value >>> 0).toString(16).padStart(8, '0')}`;
}

export function issueFingerprint(input: Pick<ReportIssueInput, 'type' | 'title' | 'evidence'>) {
  const evidence = input.evidence;
  return hash([
    normalize(input.type),
    normalize(input.title),
    normalize(evidence?.component ?? ''),
    normalize(evidence?.route ?? ''),
    normalize(evidence?.message ?? ''),
  ].join('|'));
}

function priorityRank(priority: IssuePriority) {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 })[priority];
}

export class AngelIssueRegistry {
  private issues = new Map<string, AngelIssue>();
  private loaded = false;

  constructor(
    private readonly store: KeyValueCache,
    private readonly eventLog?: AngelEventLog,
    private readonly telemetry?: AngelTelemetry,
  ) {}

  private async ensureLoaded() {
    if (this.loaded) return;
    const saved = await this.store.get<AngelIssue[]>(STORE_KEY);
    for (const issue of saved ?? []) this.issues.set(issue.fingerprint, issue);
    this.loaded = true;
  }

  private async persist() {
    await this.store.set(STORE_KEY, [...this.issues.values()]);
  }

  async report(input: ReportIssueInput) {
    await this.ensureLoaded();
    const now = Date.now();
    const fingerprint = input.fingerprint ?? issueFingerprint(input);
    const existing = this.issues.get(fingerprint);

    if (existing && !['verified', 'ignored'].includes(existing.status)) {
      existing.lastSeenAt = now;
      existing.occurrences += 1;
      if (input.priority && priorityRank(input.priority) < priorityRank(existing.priority)) existing.priority = input.priority;
      if (input.evidence) existing.evidence = [...existing.evidence, input.evidence].slice(-20);
      if (input.suspectedCause) existing.suspectedCause = input.suspectedCause;
      if (input.affectedFiles?.length) existing.affectedFiles = [...new Set([...(existing.affectedFiles ?? []), ...input.affectedFiles])];
      await this.persist();
      this.telemetry?.increment('issue.recurrence', 1, { type: existing.type, priority: existing.priority });
      await this.eventLog?.append('issue.recurred', { id: existing.id, fingerprint, occurrences: existing.occurrences });
      return existing;
    }

    const issue: AngelIssue = {
      id: crypto.randomUUID(),
      fingerprint,
      title: input.title,
      type: input.type,
      priority: input.priority ?? 'P2',
      status: 'detected',
      firstSeenAt: now,
      lastSeenAt: now,
      occurrences: 1,
      evidence: input.evidence ? [input.evidence] : [],
      suspectedCause: input.suspectedCause,
      affectedFiles: input.affectedFiles,
      productionVerified: false,
    };
    this.issues.set(fingerprint, issue);
    await this.persist();
    this.telemetry?.increment('issue.detected', 1, { type: issue.type, priority: issue.priority });
    await this.eventLog?.append('issue.detected', issue);
    return issue;
  }

  async update(id: string, patch: Partial<Pick<AngelIssue, 'status' | 'priority' | 'suspectedCause' | 'affectedFiles' | 'fixCommit'>>) {
    await this.ensureLoaded();
    const issue = [...this.issues.values()].find((entry) => entry.id === id);
    if (!issue) return null;
    Object.assign(issue, patch);
    await this.persist();
    await this.eventLog?.append('issue.updated', { id, patch });
    return issue;
  }

  async addRepairNote(id: string, note: string) {
    await this.ensureLoaded();
    const issue = [...this.issues.values()].find((entry) => entry.id === id);
    if (!issue) return null;
    issue.repairNotes = [...(issue.repairNotes ?? []), note].slice(-50);
    await this.persist();
    return issue;
  }

  async verifyProduction(id: string, passed: boolean, evidence?: IssueEvidence) {
    await this.ensureLoaded();
    const issue = [...this.issues.values()].find((entry) => entry.id === id);
    if (!issue) return null;
    if (evidence) issue.evidence = [...issue.evidence, evidence].slice(-20);
    issue.productionVerified = passed;
    issue.verifiedAt = passed ? Date.now() : undefined;
    issue.status = passed ? 'verified' : 'detected';
    if (!passed) issue.occurrences += 1;
    issue.lastSeenAt = Date.now();
    await this.persist();
    this.telemetry?.increment(passed ? 'issue.production_verified' : 'issue.production_failed', 1, { type: issue.type, priority: issue.priority });
    await this.eventLog?.append(passed ? 'issue.verified' : 'issue.verification.failed', { id, passed });
    return issue;
  }

  async active(limit = 100) {
    await this.ensureLoaded();
    return [...this.issues.values()]
      .filter((issue) => !['verified', 'ignored'].includes(issue.status))
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.lastSeenAt - a.lastSeenAt)
      .slice(0, limit);
  }

  async all(limit = 500) {
    await this.ensureLoaded();
    return [...this.issues.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, limit);
  }

  async maintenanceSnapshot() {
    const issues = await this.active(500);
    return {
      generatedAt: Date.now(),
      counts: {
        total: issues.length,
        P0: issues.filter((issue) => issue.priority === 'P0').length,
        P1: issues.filter((issue) => issue.priority === 'P1').length,
        P2: issues.filter((issue) => issue.priority === 'P2').length,
        P3: issues.filter((issue) => issue.priority === 'P3').length,
      },
      issues,
    };
  }

  async exportMaintenanceMarkdown() {
    const snapshot = await this.maintenanceSnapshot();
    const lines = [
      '# Angel OS Issue Registry',
      '',
      `Generated: ${new Date(snapshot.generatedAt).toISOString()}`,
      `Open: ${snapshot.counts.total} · P0 ${snapshot.counts.P0} · P1 ${snapshot.counts.P1} · P2 ${snapshot.counts.P2} · P3 ${snapshot.counts.P3}`,
      '',
    ];
    for (const issue of snapshot.issues) {
      lines.push(`## [${issue.priority}] ${issue.title}`);
      lines.push(`- ID: ${issue.id}`);
      lines.push(`- Status: ${issue.status}`);
      lines.push(`- Type: ${issue.type}`);
      lines.push(`- Occurrences: ${issue.occurrences}`);
      lines.push(`- Last seen: ${new Date(issue.lastSeenAt).toISOString()}`);
      if (issue.suspectedCause) lines.push(`- Suspected cause: ${issue.suspectedCause}`);
      if (issue.affectedFiles?.length) lines.push(`- Files: ${issue.affectedFiles.join(', ')}`);
      if (issue.fixCommit) lines.push(`- Fix commit: ${issue.fixCommit}`);
      lines.push(`- Production verified: ${issue.productionVerified ? 'yes' : 'no'}`);
      lines.push('');
    }
    return lines.join('\n');
  }
}