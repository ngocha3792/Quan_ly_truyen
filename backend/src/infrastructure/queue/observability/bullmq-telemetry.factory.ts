import type { ObservabilityConfig } from '@/config';
import { BullMQOtel } from 'bullmq-otel';

let telemetry: BullMQOtel | undefined;

export function getBullMqTelemetry(
  config: ObservabilityConfig,
): BullMQOtel | undefined {
  if (!config.enabled || process.env.OTEL_SDK_DISABLED === 'true') {
    return undefined;
  }
  telemetry ??= new BullMQOtel({
    tracerName: config.serviceName,
    meterName: config.serviceName,
    version: config.serviceVersion,
    enableMetrics: true,
  });
  return telemetry;
}
