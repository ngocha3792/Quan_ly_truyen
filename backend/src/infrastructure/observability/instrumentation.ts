import { hostname } from 'node:os';

import { PrismaInstrumentation } from '@prisma/instrumentation';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;
let started = false;

export function startTelemetry(): Promise<void> {
  if (started || process.env.OTEL_SDK_DISABLED === 'true')
    return Promise.resolve();
  started = true;

  try {
    const sampleRatio = parseSampleRatio(
      process.env.OTEL_TRACES_SAMPLER_ARG ?? '1',
    );
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]:
          process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen-api',
        [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION ?? '0.0.1',
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
          process.env.NODE_ENV ?? 'development',
        'service.instance.id':
          process.env.SERVICE_INSTANCE_ID || `${hostname()}-${process.pid}`,
      }),
      traceExporter: new OTLPTraceExporter({
        url:
          process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
          'http://localhost:4318/v1/traces',
      }),
      sampler: new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(sampleRatio),
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingRequestHook: (request) => {
              const path = request.url?.split('?', 1)[0] ?? '';
              return (
                path === '/internal/metrics' ||
                path === '/api/v1/health/live' ||
                path === '/api/v1/health/ready'
              );
            },
          },
        }),
        new PrismaInstrumentation(),
      ],
    });
    sdk.start();
  } catch (error: unknown) {
    sdk = undefined;
    writeTelemetryBootstrapFailure(error);
  }
  return Promise.resolve();
}

export async function shutdownTelemetry(): Promise<void> {
  const activeSdk = sdk;
  sdk = undefined;
  if (!activeSdk) return;
  try {
    await activeSdk.shutdown();
  } catch (error: unknown) {
    writeTelemetryBootstrapFailure(error);
  }
}

export function parseSampleRatio(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0, parsed));
}

function writeTelemetryBootstrapFailure(error: unknown): void {
  const record = {
    timestamp: new Date().toISOString(),
    level: 'error',
    event: 'telemetry.bootstrap.failed',
    'service.name': process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen-api',
    'service.version': process.env.OTEL_SERVICE_VERSION ?? '0.0.1',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
    'service.instance.id':
      process.env.SERVICE_INSTANCE_ID || `${hostname()}-${process.pid}`,
    'error.type': error instanceof Error ? error.name : 'UnknownError',
    'error.message': error instanceof Error ? error.message : String(error),
    'error.stack': error instanceof Error ? error.stack : undefined,
  };
  try {
    process.stderr.write(`${JSON.stringify(record)}\n`);
  } catch {
    // Telemetry startup must remain fail-open.
  }
}
