import { expect, test as base } from '@playwright/test';

import { runBackendScript } from '../support/backend-script';

export const test = base.extend({
  page: async ({ page }, use) => {
    /**
     * Rebuild the public story fixture for every test/retry.
     * This keeps direct single-file runs deterministic and prevents a
     * previous failed/mutating E2E run from leaking story/chapter state.
     */
    if (process.env['E2E_EXTERNAL'] !== 'true') {
      runBackendScript('db:seed:e2e:stories');
    }

    await use(page);
  },
});

export { expect };
