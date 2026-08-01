import { ConfigService } from '@nestjs/config';

import type { QueueConfig, RedisConfig } from '@/config';

type WorkerRole = QueueConfig['workerRole'];

export function assertWorkerCanStart(configService: ConfigService): void {
  const queue = configService.getOrThrow<QueueConfig>('queue');
  const redis = configService.getOrThrow<RedisConfig>('redis');
  const cloudinaryEnabled = configService.get<boolean>(
    'cloudinary.enabled',
    false,
  );
  const queueActive = queue.enabled && redis.enabled;

  assertWorkerCapabilities({
    role: queue.workerRole,
    queueActive,
    cloudinaryActive: cloudinaryEnabled,
  });
}

export function assertWorkerCapabilities(input: {
  role: WorkerRole;
  queueActive: boolean;
  cloudinaryActive: boolean;
}): void {
  if (input.role === 'queue' && !input.queueActive) {
    throw new Error(
      'WORKER_ROLE=queue requires QUEUE_ENABLED=true and REDIS_ENABLED=true',
    );
  }

  if (input.role === 'cloudinary-webhook' && !input.cloudinaryActive) {
    throw new Error(
      'WORKER_ROLE=cloudinary-webhook requires CLOUDINARY_ENABLED=true',
    );
  }

  if (input.role === 'all' && !input.queueActive && !input.cloudinaryActive) {
    throw new Error(
      'WORKER_ROLE=all requires at least one active queue or Cloudinary capability',
    );
  }
}
