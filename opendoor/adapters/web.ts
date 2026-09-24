// SPDX-License-Identifier: GPL-2.0-only
import type { OpenDoorOSAdapter } from '../core/types';

export const webRuntimeAdapter: OpenDoorOSAdapter<{ runtime: 'web' }> = {
  id: 'angel.web.runtime',
  capability: 'network',
  connect: () => ({ runtime: 'web' }),
};
