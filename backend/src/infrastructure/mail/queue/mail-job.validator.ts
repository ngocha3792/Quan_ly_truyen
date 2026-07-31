import type { SendMailJobV1 } from '@/infrastructure/queue/contracts';

import { InvalidMailJobException } from '../exceptions';

export function validateMailJob(
  value: unknown,
): asserts value is SendMailJobV1 {
  if (!value || typeof value !== 'object')
    throw new InvalidMailJobException('Mail payload must be an object');
  const job = value as Partial<SendMailJobV1>;
  if (job.version !== 1)
    throw new InvalidMailJobException('Unsupported mail job version');
  if (typeof job.templateId !== 'string' || !job.templateId)
    throw new InvalidMailJobException('templateId is required');
  if (typeof job.recipientEmail !== 'string' || !job.recipientEmail)
    throw new InvalidMailJobException('recipientEmail is required');
  if (
    !job.variables ||
    typeof job.variables !== 'object' ||
    Array.isArray(job.variables)
  )
    throw new InvalidMailJobException('variables must be an object');
}
