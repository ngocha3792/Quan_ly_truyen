import { loadEnvironmentFiles } from './bootstrap/environment-loader';
import { writeEntrypointFailure } from './bootstrap/entrypoint-logger';

loadEnvironmentFiles();
process.env.OTEL_SERVICE_NAME ??= 'quan-ly-truyen-worker';

async function main(): Promise<void> {
  const { startTelemetry } =
    await import('./infrastructure/observability/instrumentation');
  await startTelemetry();
  const { runWorker } = await import('./bootstrap/worker.bootstrap');
  await runWorker();
}

void main().catch((error: unknown) => {
  writeEntrypointFailure('worker.entrypoint.failed', error);
  process.exitCode = 1;
});
