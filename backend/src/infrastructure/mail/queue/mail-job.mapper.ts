import type { SendMailJobV1 } from '@/infrastructure/queue/contracts';

import type { DispatchMailInput } from '../application';

export function mapMailJob(
  payload: SendMailJobV1,
  outboxEventId: string,
): DispatchMailInput {
  return { ...payload, outboxEventId };
}
