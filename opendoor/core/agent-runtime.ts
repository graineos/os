// SPDX-License-Identifier: GPL-2.0-only

export type AngelAgentRole =
  | 'guardian'
  | 'engineer'
  | 'research'
  | 'career'
  | 'content'
  | 'personal'
  | 'auditor'
  | string;

export type AgentTask = {
  id: string;
  role: AngelAgentRole;
  objective: string;
  input?: Record<string, unknown>;
};

export type AgentEvidence = {
  source: string;
  checkedAt: number;
  data?: Record<string, unknown>;
};

export type AgentResult = {
  ok: boolean;
  summary: string;
  evidence?: AgentEvidence[];
  output?: Record<string, unknown>;
};

export interface AngelAgent {
  readonly id: string;
  readonly role: AngelAgentRole;
  execute(task: AgentTask): Promise<AgentResult>;
}

export class AngelAgentRuntime {
  private readonly agents = new Map<AngelAgentRole, AngelAgent[]>();

  register(agent: AngelAgent): this {
    const current = this.agents.get(agent.role) ?? [];
    current.push(agent);
    this.agents.set(agent.role, current);
    return this;
  }

  roles() {
    return [...this.agents.keys()];
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    const candidates = this.agents.get(task.role) ?? [];
    if (!candidates.length) {
      return { ok: false, summary: `No agent registered for role: ${task.role}` };
    }

    const failures: string[] = [];
    for (const agent of candidates) {
      try {
        const result = await agent.execute(task);
        if (result.ok) return result;
        failures.push(`${agent.id}: ${result.summary}`);
      } catch (error) {
        failures.push(`${agent.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    return {
      ok: false,
      summary: `All ${task.role} agents failed: ${failures.join(' | ')}`,
      output: { failures },
    };
  }

  async audit(task: AgentTask, result: AgentResult): Promise<AgentResult> {
    const auditors = this.agents.get('auditor') ?? [];
    if (!auditors.length) return result;

    for (const auditor of auditors) {
      const audit = await auditor.execute({
        id: `${task.id}:audit:${auditor.id}`,
        role: 'auditor',
        objective: `Verify the result of: ${task.objective}`,
        input: { task, result },
      });
      if (!audit.ok) {
        return {
          ok: false,
          summary: `Audit rejected result: ${audit.summary}`,
          evidence: [...(result.evidence ?? []), ...(audit.evidence ?? [])],
          output: { original: result.output, audit: audit.output },
        };
      }
    }
    return result;
  }
}
