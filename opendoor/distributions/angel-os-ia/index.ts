// SPDX-License-Identifier: GPL-2.0-only
import type { OpenDoorOSContext, OpenDoorOSDistribution, OpenDoorOSModule } from '../../core/types';

function module(id: string, provides: string[]): OpenDoorOSModule {
  return {
    id: `angel-os-ia.${id}`,
    version: '0.3.0',
    requires: ['events', 'configuration'],
    provides,
    start(_context: OpenDoorOSContext) {
      // Angel OS IA consumes neutral Angel OS system services through adapters.
      // Personal logic must stay here and never leak into the reusable core.
    },
  };
}

const aiProviderModule = module('providers', ['ai-providers']);
const conversationModule = module('conversation', ['conversation', 'contextual-assistance']);
const analysisModule = module('analysis', ['ai-analysis', 'recommendations']);
const generationModule = module('generation', ['content-generation']);
const agentModule = module('agents', ['ai-agents', 'ai-orchestration']);
const automationModule = module('automation', ['intelligent-automation']);
const personalMemoryModule = module('personal-memory', ['personal-memory', 'preference-context', 'user-history']);
const personalSupervisorModule = module('personal-supervisor', ['personal-prioritization', 'intelligent-supervision', 'decision-support']);
const personalDomainsModule = module('personal-domains', [
  'applications-tracking',
  'mail-intelligence',
  'calendar-intelligence',
  'personal-news',
  'media-recommendations',
]);

export const ANGEL_OS_IA_BOUNDARY = {
  dependsOn: 'angel-os',
  coreDependencyDirection: 'angel-os-ia -> angel-os',
  forbiddenDirection: 'angel-os -> angel-os-ia',
  systemCapabilitiesRemainInAngelOs: true,
  personalCapabilitiesRemainInAngelOsIa: true,
} as const;

export const angelOSIA: OpenDoorOSDistribution = {
  id: 'angel-os-ia',
  name: 'Angel OS IA',
  version: '0.3.0',
  modules: [
    aiProviderModule,
    conversationModule,
    analysisModule,
    generationModule,
    agentModule,
    automationModule,
    personalMemoryModule,
    personalSupervisorModule,
    personalDomainsModule,
  ],
};

export default angelOSIA;
