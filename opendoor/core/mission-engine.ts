// SPDX-License-Identifier: GPL-2.0-only

export type MissionPriority = 'low' | 'normal' | 'high' | 'critical';
export type MissionState = 'planned' | 'running' | 'blocked' | 'completed' | 'failed';

export type MissionStepResult = {
  ok: boolean;
  summary: string;
  evidence?: Record<string, unknown>;
  retryable?: boolean;
};

export type MissionContext = {
  missionId: string;
  goal: string;
  metadata: Record<string, unknown>;
};

export type MissionStep = {
  id: string;
  title: string;
  agent: string;
  dependsOn?: string[];
  run: (context: MissionContext) => Promise<MissionStepResult>;
  verify?: (context: MissionContext, result: MissionStepResult) => Promise<MissionStepResult>;
};

export type Mission = {
  id: string;
  goal: string;
  priority: MissionPriority;
  state: MissionState;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
  steps: MissionStep[];
  results: Record<string, MissionStepResult>;
};

export type MissionPlanner = (goal: string, metadata: Record<string, unknown>) => Promise<MissionStep[]>;

export class AngelMissionEngine {
  private readonly missions = new Map<string, Mission>();

  constructor(private readonly planner?: MissionPlanner) {}

  async create(input: {
    goal: string;
    priority?: MissionPriority;
    metadata?: Record<string, unknown>;
    steps?: MissionStep[];
  }): Promise<Mission> {
    const id = crypto.randomUUID();
    const metadata = input.metadata ?? {};
    const steps = input.steps ?? (this.planner ? await this.planner(input.goal, metadata) : []);
    const now = Date.now();
    const mission: Mission = {
      id,
      goal: input.goal,
      priority: input.priority ?? 'normal',
      state: 'planned',
      createdAt: now,
      updatedAt: now,
      metadata,
      steps,
      results: {},
    };
    this.missions.set(id, mission);
    return mission;
  }

  get(id: string) {
    return this.missions.get(id) ?? null;
  }

  list() {
    return [...this.missions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async run(id: string): Promise<Mission> {
    const mission = this.missions.get(id);
    if (!mission) throw new Error(`Unknown mission: ${id}`);
    mission.state = 'running';
    mission.updatedAt = Date.now();

    const context: MissionContext = {
      missionId: mission.id,
      goal: mission.goal,
      metadata: mission.metadata,
    };

    for (const step of mission.steps) {
      const dependencies = step.dependsOn ?? [];
      if (dependencies.some((dependency) => !mission.results[dependency]?.ok)) {
        mission.state = 'blocked';
        mission.updatedAt = Date.now();
        return mission;
      }

      let result: MissionStepResult;
      try {
        result = await step.run(context);
        if (result.ok && step.verify) {
          result = await step.verify(context, result);
        }
      } catch (error) {
        result = {
          ok: false,
          summary: error instanceof Error ? error.message : 'Unknown mission step failure',
          retryable: true,
        };
      }
      mission.results[step.id] = result;
      mission.updatedAt = Date.now();

      if (!result.ok && !result.retryable) {
        mission.state = 'failed';
        return mission;
      }
      if (!result.ok) {
        mission.state = 'blocked';
        return mission;
      }
    }

    mission.state = 'completed';
    mission.updatedAt = Date.now();
    return mission;
  }
}
