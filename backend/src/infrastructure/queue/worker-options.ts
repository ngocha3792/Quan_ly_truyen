const DEFAULT_WORKER_CONCURRENCY = 5;

export function getWorkerConcurrency(
  value = process.env.WORKER_CONCURRENCY,
): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_WORKER_CONCURRENCY;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new Error('WORKER_CONCURRENCY must be an integer between 1 and 50');
  }
  return parsed;
}
