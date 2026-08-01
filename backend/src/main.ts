import { loadEnvironmentFiles } from './bootstrap/environment-loader';
import { writeEntrypointFailure } from './bootstrap/entrypoint-logger';

loadEnvironmentFiles();
process.env.OTEL_SERVICE_NAME ??= 'quan-ly-truyen-api';

async function main(): Promise<void> {
  const { startTelemetry } =
    await import('./infrastructure/observability/instrumentation');
  await startTelemetry();
  const { runApplication } = await import('./bootstrap/application.bootstrap');
  await runApplication();
}

void main().catch((error: unknown) => {
  writeEntrypointFailure('application.entrypoint.failed', error);
  process.exitCode = 1;
});
