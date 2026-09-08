import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { ConfigurationException } from '@/common/exceptions';
import type { CorsConfig, ReaderFeaturesConfig, RedisConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis';
import { RedisSocketIoAdapter } from '@/infrastructure/websocket/redis-socket-io.adapter';

export async function configureWebSockets(
  app: INestApplication,
): Promise<void> {
  const config = app.get(ConfigService);
  const readerFeatures =
    config.getOrThrow<ReaderFeaturesConfig>('readerFeatures');
  if (!readerFeatures.realtimeProgressSyncEnabled) return;

  const redisConfig = config.getOrThrow<RedisConfig>('redis');
  if (!redisConfig.enabled) {
    throw new ConfigurationException({
      key: 'REDIS_ENABLED',
      message: 'Realtime reading progress requires Redis pub/sub',
    });
  }

  const baseClient = app.get<Redis | null>(REDIS_CLIENT);
  if (!baseClient) {
    throw new ConfigurationException({
      key: 'REDIS_URL',
      message: 'Redis client is unavailable for realtime reading progress',
    });
  }

  const publisher = baseClient.duplicate();
  const subscriber = baseClient.duplicate();
  try {
    await Promise.all([publisher.ping(), subscriber.ping()]);
  } catch (cause: unknown) {
    publisher.disconnect();
    subscriber.disconnect();
    throw new ConfigurationException({
      key: 'REDIS_URL',
      message: 'Cannot initialize Redis pub/sub for realtime reading progress',
      cause,
    });
  }

  app.useWebSocketAdapter(
    new RedisSocketIoAdapter(
      app,
      publisher,
      subscriber,
      redisConfig,
      config.getOrThrow<CorsConfig>('cors'),
    ),
  );
}
