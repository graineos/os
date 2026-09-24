// SPDX-License-Identifier: GPL-2.0-only

export type OpenDoorOSCapability =
  | 'events'
  | 'configuration'
  | 'storage'
  | 'network'
  | 'identity'
  | 'ai'
  | 'automation'
  | string;

export interface OpenDoorOSContext {
  readonly version: string;
  readonly platform: string;
  readonly capabilities: ReadonlySet<OpenDoorOSCapability>;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface OpenDoorOSModule {
  readonly id: string;
  readonly version: string;
  readonly requires?: readonly OpenDoorOSCapability[];
  readonly provides?: readonly OpenDoorOSCapability[];
  start(context: OpenDoorOSContext): void | Promise<void>;
  stop?(context: OpenDoorOSContext): void | Promise<void>;
}

export interface OpenDoorOSAdapter<T = unknown> {
  readonly id: string;
  readonly capability: OpenDoorOSCapability;
  connect(): T | Promise<T>;
  disconnect?(): void | Promise<void>;
}

export interface OpenDoorOSDistribution {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly modules: readonly OpenDoorOSModule[];
  readonly adapters?: readonly OpenDoorOSAdapter[];
}
