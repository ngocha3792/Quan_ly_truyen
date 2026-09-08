import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

import type { CorsConfig, RedisConfig } from '@/config';

export class RedisSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
    private readonly redisConfig: RedisConfig,
    private readonly corsConfig: CorsConfig,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: [...this.corsConfig.allowedOrigins],
        credentials: this.corsConfig.credentials,
        maxAge: this.corsConfig.maxAgeSeconds,
      },
    }) as Server;

    server.adapter(
      createAdapter(this.publisher, this.subscriber, {
        key: `${this.redisConfig.keyPrefix}:reading-progress:socket.io`,
      }),
    );
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }
}
