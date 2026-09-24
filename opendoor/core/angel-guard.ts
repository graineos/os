// SPDX-License-Identifier: GPL-2.0-only

export type GuardSeverity = 'info' | 'warning' | 'critical';
export type GuardAction = 'allow' | 'observe' | 'challenge' | 'rate-limit' | 'isolate' | 'recover' | 'rollback' | 'block';
export type GuardFamily = 'auth' | 'waf' | 'bot' | 'rate-limit' | 'access' | 'provider' | 'deployment' | 'system' | 'unknown';

export type GuardSignal = {
  id: string;
  source: string;
  type: string;
  severity: GuardSeverity;
  at: number;
  message: string;
  family?: GuardFamily;
  clientIp?: string | null;
  path?: string | null;
  method?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type GuardDecision = {
  signalId: string;
  action: GuardAction;
  reason: string;
  automatic: boolean;
  decidedAt: number;
};

export type GuardExecution = {
  signalId: string;
  action: GuardAction;
  status: 'executed' | 'unavailable' | 'failed';
  executorId?: string;
  detail?: string;
  executedAt: number;
};

export type GuardPolicy = {
  id: string;
  priority: number;
  family?: GuardFamily;
  description?: string;
  matches: (signal: GuardSignal) => boolean;
  decide: (signal: GuardSignal) => GuardDecision;
};

export type GuardExecutor = {
  id: string;
  action: GuardAction;
  canExecute?: (signal: GuardSignal, decision: GuardDecision) => Promise<boolean> | boolean;
  execute: (signal: GuardSignal, decision: GuardDecision) => Promise<{ ok: boolean; detail?: string }>;
};

export type GuardProtectionProfile = {
  id: 'observe' | 'balanced' | 'strict';
  label: string;
  description: string;
  automaticBlocking: boolean;
  rateLimiting: boolean;
  botChallenge: boolean;
};

export const ANGEL_GUARD_PROFILES: GuardProtectionProfile[] = [
  {
    id: 'observe',
    label: 'Observation',
    description: 'Journalise et classe les signaux sans blocage automatique.',
    automaticBlocking: false,
    rateLimiting: false,
    botChallenge: false,
  },
  {
    id: 'balanced',
    label: 'Équilibré',
    description: 'Bloque les attaques évidentes et limite les abus sans durcir tout le trafic.',
    automaticBlocking: true,
    rateLimiting: true,
    botChallenge: true,
  },
  {
    id: 'strict',
    label: 'Strict',
    description: 'Protection renforcée pour les zones sensibles et les périodes à risque.',
    automaticBlocking: true,
    rateLimiting: true,
    botChallenge: true,
  },
];

function normalizedSignal(signal: GuardSignal) {
  return `${signal.family ?? ''} ${signal.type} ${signal.source} ${signal.message} ${signal.path ?? ''}`.toLowerCase();
}

/** Angel Guard is the security and supervision layer used by Flamme OS. */
export class AngelGuardOS {
  private policies: GuardPolicy[] = [];
  private executors: GuardExecutor[] = [];
  private signals: GuardSignal[] = [];
  private decisions: GuardDecision[] = [];
  private executions: GuardExecution[] = [];
  private profile: GuardProtectionProfile['id'] = 'balanced';

  setProfile(profile: GuardProtectionProfile['id']) {
    this.profile = profile;
    return this;
  }

  register(policy: GuardPolicy) {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.priority - a.priority);
    return this;
  }

  registerExecutor(executor: GuardExecutor) {
    this.executors = this.executors.filter((candidate) => candidate.id !== executor.id);
    this.executors.push(executor);
    return this;
  }

  evaluate(signal: GuardSignal): GuardDecision {
    this.signals.unshift(signal);
    this.signals = this.signals.slice(0, 1000);
    const policy = this.policies.find((candidate) => candidate.matches(signal));
    const decision = policy
      ? policy.decide(signal)
      : { signalId: signal.id, action: signal.severity === 'critical' ? 'isolate' : 'observe', reason: 'Default Angel Guard policy', automatic: true, decidedAt: Date.now() } satisfies GuardDecision;
    this.decisions.unshift(decision);
    this.decisions = this.decisions.slice(0, 1000);
    return decision;
  }

  async enforce(signal: GuardSignal, decision: GuardDecision): Promise<GuardExecution> {
    const candidates = this.executors.filter((executor) => executor.action === decision.action);
    let selected: GuardExecutor | undefined;
    for (const executor of candidates) {
      try {
        if (!executor.canExecute || await executor.canExecute(signal, decision)) {
          selected = executor;
          break;
        }
      } catch {
        // A failing capability check must never be interpreted as permission to execute.
      }
    }

    if (!selected) {
      const execution: GuardExecution = {
        signalId: signal.id,
        action: decision.action,
        status: 'unavailable',
        detail: 'No verified executor is available for this action',
        executedAt: Date.now(),
      };
      this.rememberExecution(execution);
      return execution;
    }

    try {
      const result = await selected.execute(signal, decision);
      const execution: GuardExecution = {
        signalId: signal.id,
        action: decision.action,
        status: result.ok ? 'executed' : 'failed',
        executorId: selected.id,
        detail: result.detail,
        executedAt: Date.now(),
      };
      this.rememberExecution(execution);
      return execution;
    } catch (error) {
      const execution: GuardExecution = {
        signalId: signal.id,
        action: decision.action,
        status: 'failed',
        executorId: selected.id,
        detail: error instanceof Error ? error.message : 'Executor failed',
        executedAt: Date.now(),
      };
      this.rememberExecution(execution);
      return execution;
    }
  }

  private rememberExecution(execution: GuardExecution) {
    this.executions.unshift(execution);
    this.executions = this.executions.slice(0, 1000);
  }

  snapshot() {
    const profile = ANGEL_GUARD_PROFILES.find((candidate) => candidate.id === this.profile) ?? ANGEL_GUARD_PROFILES[1];
    return {
      generatedAt: Date.now(),
      profile,
      policies: this.policies.map(({ id, priority, family, description }) => ({ id, priority, family: family ?? 'unknown', description: description ?? null })),
      executors: this.executors.map(({ id, action }) => ({ id, action })),
      recentSignals: this.signals.slice(0, 20),
      recentDecisions: this.decisions.slice(0, 20),
      recentExecutions: this.executions.slice(0, 20),
      automation: true,
      capabilities: {
        wafSignals: true,
        attackClassification: true,
        accessControlSignals: true,
        botSignals: true,
        rateLimitDecisions: true,
        incidentRecovery: true,
        reverseProxyEnforcement: this.executors.some((executor) => ['block', 'challenge', 'rate-limit'].includes(executor.action)),
      },
    };
  }
}

export function createDefaultAngelGuard() {
  return new AngelGuardOS()
    .setProfile('balanced')
    .register({
      id: 'critical-auth-block', priority: 120, family: 'auth', description: 'Bloque les anomalies critiques liées aux accès, sessions et identifiants.',
      matches: (signal) => signal.severity === 'critical' && /auth|access|session|credential|token/i.test(normalizedSignal(signal)),
      decide: (signal) => ({ signalId: signal.id, action: 'block', reason: 'Critical authentication anomaly', automatic: true, decidedAt: Date.now() }),
    })
    .register({
      id: 'web-attack-block', priority: 115, family: 'waf', description: 'Classe les signaux correspondant aux principales attaques Web et demande leur blocage.',
      matches: (signal) => /sql.?injection|sqli|xss|cross.?site|rce|remote.?code|command.?injection|xxe|ssrf|path.?traversal|lfi|rfi|crlf|ldap.?injection|xpath.?injection|webshell|backdoor/i.test(normalizedSignal(signal)),
      decide: (signal) => ({ signalId: signal.id, action: 'block', reason: 'Web attack signature detected', automatic: true, decidedAt: Date.now() }),
    })
    .register({
      id: 'abusive-client-rate-limit', priority: 105, family: 'rate-limit', description: 'Limite les clients générant trop de requêtes, erreurs ou tentatives répétées.',
      matches: (signal) => /rate.?limit|too.?many|http.?flood|brute.?force|request.?burst|traffic.?surge|abuse/i.test(normalizedSignal(signal)),
      decide: (signal) => ({ signalId: signal.id, action: 'rate-limit', reason: 'Abusive request rate detected', automatic: true, decidedAt: Date.now() }),
    })
    .register({
      id: 'suspicious-bot-challenge', priority: 100, family: 'bot', description: 'Déclenche un challenge pour les automatisations ou bots suspects lorsqu’un exécuteur est disponible.',
      matches: (signal) => /bot|crawler|scraper|automation|headless|challenge/i.test(normalizedSignal(signal)) && signal.severity !== 'info',
      decide: (signal) => ({ signalId: signal.id, action: 'challenge', reason: 'Suspicious automated client', automatic: true, decidedAt: Date.now() }),
    })
    .register({
      id: 'access-policy-block', priority: 95, family: 'access', description: 'Applique les décisions issues des listes d’accès, IP bloquées ou zones protégées.',
      matches: (signal) => /denylist|blocklist|bad.?ip|forbidden.?country|acl|access.?control|restricted.?path/i.test(normalizedSignal(signal)),
      decide: (signal) => ({ signalId: signal.id, action: 'block', reason: 'Access control policy matched', automatic: true, decidedAt: Date.now() }),
    })
    .register({
      id: 'provider-recovery', priority: 80, family: 'provider', description: 'Déclenche récupération ou fallback lorsqu’un fournisseur ou service externe tombe.',
      matches: (signal) => /provider|api|upstream|timeout/i.test(normalizedSignal(signal)),
      decide: (signal) => ({ signalId: signal.id, action: 'recover', reason: 'Provider failure: retry or fallback', automatic: true, decidedAt: Date.now() }),
    })
    .register({
      id: 'deployment-rollback', priority: 70, family: 'deployment', description: 'Demande un rollback lors d’une régression critique de production.',
      matches: (signal) => signal.severity === 'critical' && /deploy|production|release/i.test(normalizedSignal(signal)),
      decide: (signal) => ({ signalId: signal.id, action: 'rollback', reason: 'Critical production regression', automatic: true, decidedAt: Date.now() }),
    });
}
