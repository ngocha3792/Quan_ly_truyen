import { hostname } from 'node:os';

export function writeEntrypointFailure(event: string, error: unknown): void {
  const record = {
    timestamp: new Date().toISOString(),
    level: 'error',
    event,
    'service.name': process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen-api',
    'service.version': process.env.OTEL_SERVICE_VERSION ?? '0.0.1',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
    'service.instance.id':
      process.env.SERVICE_INSTANCE_ID ?? `${hostname()}-${process.pid}`,
    'error.type': error instanceof Error ? error.name : 'UnknownError',
  };
  try {
    process.stderr.write(`${JSON.stringify(record)}\n`);
  } catch {
    // A logging failure cannot replace the original bootstrap failure.
  }
}
