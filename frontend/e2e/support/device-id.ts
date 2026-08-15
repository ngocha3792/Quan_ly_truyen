import { createHash } from 'node:crypto';

import type { TestInfo } from '@playwright/test';

export function createDeterministicDeviceId(prefix: string, testInfo: TestInfo): string {
  const fingerprint = [
    testInfo.project.name,
    testInfo.file,
    testInfo.title,
    testInfo.retry,
    testInfo.repeatEachIndex,
    testInfo.workerIndex,
  ].join('|');

  const digest = createHash('sha256').update(fingerprint, 'utf8').digest('hex').slice(0, 24);

  return `${prefix}-${digest}`;
}
