// SPDX-License-Identifier: GPL-2.0-only

export type CapabilityState = "active" | "available" | "deferred" | "unavailable";

export type AngelCapability = {
  id:
    | "react"
    | "typescript"
    | "tailwind"
    | "vite"
    | "framer-motion"
    | "native-storage"
    | "native-cache"
    | "native-worker"
    | "event-log"
    | "telemetry"
    | "memory-index"
    | "durable-workflow"
    | "hybrid-orchestrator"
    | "release-manager"
    | "deploy-engine"
    | "node-gateway"
    | "guardian-recovery"
    | "sync-engine"
    | "express"
    | "mysql"
    | "redis"
    | "python"
    | "rust"
    | "ztp";
  label: string;
  state: CapabilityState;
  role: string;
  fallback?: string;
  manualSetupRequired: boolean;
};

/** Source of truth for Angel OS itself. Angel OS IA capabilities live in its distribution. */
export const ANGEL_OS_CAPABILITIES: AngelCapability[] = [
  { id: "react", label: "React", state: "active", role: "Interface web", manualSetupRequired: false },
  { id: "typescript", label: "TypeScript", state: "active", role: "Application and core typing", manualSetupRequired: false },
  { id: "tailwind", label: "Tailwind CSS", state: "active", role: "Design system and responsive UI", manualSetupRequired: false },
  { id: "vite", label: "Vite", state: "active", role: "Build and development pipeline", manualSetupRequired: false },
  { id: "framer-motion", label: "Framer Motion", state: "active", role: "UI motion and transitions", manualSetupRequired: false },

  { id: "native-storage", label: "Angel Native Storage", state: "active", role: "Private/offline persistence", manualSetupRequired: false },
  { id: "native-cache", label: "Angel Native Cache", state: "active", role: "Fast internal cache", manualSetupRequired: false },
  { id: "native-worker", label: "Angel Native Worker", state: "active", role: "In-process task execution", manualSetupRequired: false },
  { id: "event-log", label: "Angel Event Log", state: "active", role: "System event chronology", manualSetupRequired: false },
  { id: "telemetry", label: "Angel Telemetry", state: "active", role: "Metrics and performance observations", manualSetupRequired: false },
  { id: "memory-index", label: "Angel Memory Index", state: "active", role: "Cross-module searchable memory", manualSetupRequired: false },
  { id: "durable-workflow", label: "Durable Workflow Engine", state: "active", role: "Checkpointed retryable workflows", manualSetupRequired: false },
  { id: "hybrid-orchestrator", label: "Hybrid Orchestrator", state: "active", role: "External + native provider orchestration", manualSetupRequired: false },
  { id: "release-manager", label: "Angel Release", state: "active", role: "Immutable release metadata and target states", manualSetupRequired: false },
  { id: "deploy-engine", label: "Angel Deploy", state: "active", role: "Multi-target deployment orchestration", manualSetupRequired: false },
  { id: "node-gateway", label: "Angel Gateway", state: "active", role: "Node health ranking and routing decisions", manualSetupRequired: false },
  { id: "guardian-recovery", label: "Guardian + Recovery", state: "active", role: "Failure detection and recovery policy", manualSetupRequired: false },
  { id: "sync-engine", label: "Angel Sync", state: "active", role: "Versioned reconciliation and conflict detection", manualSetupRequired: false },

  { id: "express", label: "Express", state: "deferred", role: "Standalone Angel OS API on managed Linux", fallback: "TanStack Start server routes + Angel Native API Router", manualSetupRequired: true },
  { id: "mysql", label: "MySQL", state: "deferred", role: "Portable relational storage", fallback: "Current production data layer + Angel Native Storage", manualSetupRequired: true },
  { id: "redis", label: "Redis", state: "deferred", role: "Extra cache, queue and ephemeral state capacity", fallback: "Angel Native Realtime", manualSetupRequired: true },
  { id: "python", label: "Python", state: "available", role: "Automation and data workers when executable", fallback: "Angel Native Worker", manualSetupRequired: false },
  { id: "rust", label: "Rust", state: "deferred", role: "Performance-critical system tooling", fallback: "TypeScript / Angel Native Worker", manualSetupRequired: true },
  { id: "ztp", label: "Zero-touch provisioning", state: "deferred", role: "Automatic Linux node bootstrap", fallback: "Current managed pipeline", manualSetupRequired: true },
];

export function getActiveCapabilities() {
  return ANGEL_OS_CAPABILITIES.filter((capability) => capability.state === "active" || capability.state === "available");
}

export function getDeferredCapabilities() {
  return ANGEL_OS_CAPABILITIES.filter((capability) => capability.state === "deferred" || capability.state === "unavailable");
}

export function canEnableWithoutUserAction(id: AngelCapability["id"]) {
  const capability = ANGEL_OS_CAPABILITIES.find((item) => item.id === id);
  return Boolean(capability && !capability.manualSetupRequired && capability.state !== "unavailable");
}
