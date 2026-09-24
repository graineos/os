// SPDX-License-Identifier: GPL-2.0-only
export type OpenDoorOSConfig = Record<string, unknown>;

export function createConfig(defaults: OpenDoorOSConfig, overrides: OpenDoorOSConfig = {}): Readonly<OpenDoorOSConfig> {
  return Object.freeze({ ...defaults, ...overrides });
}
