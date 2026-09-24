// SPDX-License-Identifier: GPL-2.0-only
import type { OpenDoorOSAdapter } from '../core/types';

export type AngelLeclercWebConnection = {
  product: 'angel-leclerc.fr';
  platform: 'web';
  publicBaseUrl: 'https://www.angel-leclerc.fr';
  adminPath: '/admin';
};

export const angelLeclercWebAdapter: OpenDoorOSAdapter<AngelLeclercWebConnection> = {
  id: 'angel-leclerc.fr.web',
  capability: 'network',
  connect() {
    return {
      product: 'angel-leclerc.fr',
      platform: 'web',
      publicBaseUrl: 'https://www.angel-leclerc.fr',
      adminPath: '/admin',
    };
  },
};

export default angelLeclercWebAdapter;
