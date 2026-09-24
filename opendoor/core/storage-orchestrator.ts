// SPDX-License-Identifier: GPL-2.0-only

export type StorageObject = {
  id: string;
  name: string;
  size: number;
  mimeType?: string;
  url: string;
  provider: string;
  tier: 'primary' | 'archive' | 'backup';
  createdAt: string;
};

export type StorageInput = {
  name: string;
  size: number;
  mimeType?: string;
  bytes?: Uint8Array;
  sourceUrl?: string;
};

export interface StorageProvider {
  id: string;
  tier: StorageObject['tier'];
  health(): Promise<boolean>;
  canStore(input: StorageInput): Promise<boolean> | boolean;
  put(input: StorageInput): Promise<StorageObject>;
}

export type StoragePolicy = {
  archiveThresholdBytes: number;
  mirrorLargeFiles?: boolean;
  backupCriticalFiles?: boolean;
};

/**
 * Coordinates storage providers without making any provider mandatory.
 * Existing production storage can remain primary while Google Drive or any
 * future provider is used as an archive/backup layer by an Angel OS worker.
 */
export class StorageOrchestrator {
  constructor(
    private readonly providers: StorageProvider[],
    private readonly policy: StoragePolicy,
  ) {}

  private async healthyProviders() {
    const out: StorageProvider[] = [];
    for (const provider of this.providers) {
      try {
        if (await provider.health()) out.push(provider);
      } catch {
        // A storage extension never makes the primary flow unavailable.
      }
    }
    return out;
  }

  async plan(input: StorageInput) {
    const healthy = await this.healthyProviders();
    const compatible: StorageProvider[] = [];
    for (const provider of healthy) {
      try {
        if (await provider.canStore(input)) compatible.push(provider);
      } catch {
        // Ignore optional provider failures during planning.
      }
    }

    const primary = compatible.find((provider) => provider.tier === 'primary');
    const archive = compatible.find((provider) => provider.tier === 'archive');
    const backup = compatible.find((provider) => provider.tier === 'backup');
    const isLarge = input.size >= this.policy.archiveThresholdBytes;

    return {
      primary,
      archive: isLarge ? archive : undefined,
      backup: this.policy.backupCriticalFiles ? backup : undefined,
      isLarge,
      providers: compatible.map((provider) => provider.id),
    };
  }

  async store(input: StorageInput) {
    const plan = await this.plan(input);
    if (!plan.primary) throw new Error('No primary storage provider available');

    const primaryObject = await plan.primary.put(input);
    const replicas: StorageObject[] = [];

    const optionalTargets = [plan.archive, plan.backup].filter(Boolean) as StorageProvider[];
    if (this.policy.mirrorLargeFiles || this.policy.backupCriticalFiles) {
      await Promise.all(optionalTargets.map(async (provider) => {
        try {
          replicas.push(await provider.put({ ...input, sourceUrl: primaryObject.url }));
        } catch {
          // Primary upload remains successful even if an optional mirror fails.
        }
      }));
    }

    return {
      primary: primaryObject,
      replicas,
      archived: replicas.some((item) => item.tier === 'archive'),
      backedUp: replicas.some((item) => item.tier === 'backup'),
    };
  }
}
