// SPDX-License-Identifier: AGPL-3.0-only
import type { OpenDoorOSAdapter } from '../core/types';

export const webRuntimeAdapter: OpenDoorOSAdapter<{ runtime: 'web' }> = {
  id: 'angel.web.runtime',
  capability: 'network',
  connect: () => ({ runtime: 'web' }),
};
