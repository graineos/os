// SPDX-License-Identifier: GPL-2.0-only

export type AngelLayer = 'angel-os' | 'angel-os-ia' | 'application';

export type AngelCapabilityDescriptor = {
  id: string;
  layer: AngelLayer;
  description: string;
  requires?: string[];
};

export const ANGEL_SYSTEM_BOUNDARY = {
  angelOs: {
    role: 'kernel-platform',
    mayRunWithoutAi: true,
    owns: ['deploy', 'gateway', 'release', 'data', 'sync', 'memory', 'realtime', 'workflow', 'events', 'telemetry', 'guardian', 'recovery', 'storage', 'workers'],
  },
  angelOsIa: {
    role: 'ai-distribution',
    requiresAngelOs: true,
    owns: ['ai-providers', 'ai-agents', 'conversation', 'generation', 'analysis', 'recommendations', 'ai-automation'],
  },
} as const;

export function assertLayerDependency(layer: AngelLayer, dependencyLayer: AngelLayer) {
  if (layer === 'angel-os' && dependencyLayer === 'angel-os-ia') {
    throw new Error('Angel OS core cannot depend on Angel OS IA.');
  }
}
