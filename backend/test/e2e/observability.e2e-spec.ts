import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { configureApplication } from '@/bootstrap/application-configurator';
import type { AppConfig } from '@/config';
import { ConfigService } from '@nestjs/config';

describe('Observability endpoint (e2e)', () => {
  let app: INestApplication;
  const token = 'e2e-metrics-bearer-token-at-least-32-characters';

  beforeAll(async () => {
    process.env.OBSERVABILITY_ENABLED = 'true';
    process.env.METRICS_ENABLED = 'true';
    process.env.METRICS_BEARER_TOKEN = token;
    process.env.OTEL_SDK_DISABLED = 'true';
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bufferLogs: true });
    configureApplication(
      app,
      app.get(ConfigService).getOrThrow<AppConfig>('app'),
    );
    await app.init();
  });

  it('protects metrics, returns Prometheus text without an envelope, and does not self-observe', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server).get('/internal/metrics').expect(401);
    const response = await request(server)
      .get('/internal/metrics')
      .set('authorization', `Bearer ${token}`)
      .expect(200)
      .expect('content-type', /text\/plain/);

    expect(response.text).toContain('qlt_http_server_requests_total');
    expect(response.text).not.toContain('"success"');
    expect(response.text).not.toContain('/internal/metrics');
  });

  afterAll(async () => app.close());
});
