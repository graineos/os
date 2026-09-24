// SPDX-License-Identifier: GPL-2.0-only
import type { OpenDoorOSContext, OpenDoorOSModule } from './types';

export class OpenDoorOSModuleRegistry {
  private readonly modules = new Map<string, OpenDoorOSModule>();
  register(module: OpenDoorOSModule): void {
    if (this.modules.has(module.id)) throw new Error(`Duplicate module: ${module.id}`);
    this.modules.set(module.id, module);
  }
  list(): readonly OpenDoorOSModule[] { return [...this.modules.values()]; }
  async startAll(context: OpenDoorOSContext): Promise<void> {
    for (const module of this.modules.values()) await module.start(context);
  }
  async stopAll(context: OpenDoorOSContext): Promise<void> {
    for (const module of [...this.modules.values()].reverse()) await module.stop?.(context);
  }
}
