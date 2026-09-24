// SPDX-License-Identifier: GPL-2.0-only

import { AngelAgentRuntime, type AngelAgent } from './agent-runtime';
import { AngelControlPlane, type HealthProbe } from './control-plane';
import { AngelMemoryIndex, type MemoryDocument } from './memory-index';
import { AngelMissionEngine, type MissionPlanner, type MissionPriority, type MissionStep } from './mission-engine';

export type AngelCoreOptions = {
  planner?: MissionPlanner;
  memory?: AngelMemoryIndex;
  agents?: AngelAgentRuntime;
  health?: AngelControlPlane;
};

/**
 * Single coordination point for goal-driven Angel OS work.
 * Existing runtime services can be injected so the control plane never creates
 * a second, divergent source of truth.
 */
export class AngelAutonomousCore {
  readonly agents: AngelAgentRuntime;
  readonly health: AngelControlPlane;
  readonly memory: AngelMemoryIndex;
  readonly missions: AngelMissionEngine;

  constructor(options: AngelCoreOptions = {}) {
    this.agents = options.agents ?? new AngelAgentRuntime();
    this.health = options.health ?? new AngelControlPlane();
    this.memory = options.memory ?? new AngelMemoryIndex();
    this.missions = new AngelMissionEngine(options.planner);
  }

  registerAgent(agent: AngelAgent) {
    this.agents.register(agent);
    return this;
  }

  registerHealthProbe(probe: HealthProbe) {
    this.health.register(probe);
    return this;
  }

  remember(document: MemoryDocument) {
    this.memory.upsert(document);
    return this;
  }

  async pursue(input: {
    goal: string;
    priority?: MissionPriority;
    metadata?: Record<string, unknown>;
    steps?: MissionStep[];
    autoRun?: boolean;
  }) {
    const mission = await this.missions.create(input);
    if (input.autoRun === false) return mission;
    return this.missions.run(mission.id);
  }

  async inspect(options: { autoRecover?: boolean } = { autoRecover: true }) {
    return this.health.inspect(options);
  }

  status() {
    return {
      health: this.health.snapshot(),
      missions: this.missions.list(),
      memory: this.memory.stats(),
      agentRoles: this.agents.roles(),
    };
  }
}
