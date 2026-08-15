import { expect, test as base } from '@playwright/test';

import { runBackendScript } from '../support/backend-script';

export const test = base.extend({
  page: async ({ page }, use) => {
    /**
     * Public auth scenarios mutate session/rate-limit state.
     * Reset the deterministic E2E account before every test/retry so
     * project scheduling or a previous failed run cannot leak state.
     */
    if (process.env['E2E_EXTERNAL'] !== 'true') {
      runBackendScript('db:seed:e2e');
    }

    await use(page);
  },
});

export { expect };
