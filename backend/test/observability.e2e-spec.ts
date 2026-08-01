import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap/application-configurator';
import type { AppConfig } from '../src/config';
import { ConfigService } from '@nestjs/config';

describe('Observability endpoint (e2e)', () => {
  let app: INestApplication<App>;
  const token = 'e2e-metrics-bearer-token-at-least-32-characters';

  beforeAll(async () => {
    process.env.OBSERVABILITY_ENABLED = 'true';
    process.env.METRICS_ENABLED = 'true';
    process.env.METRICS_BEARER_TOKEN = token;
    process.env.OTEL_SDK_DISABLED = 'true';
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>({ bufferLogs: true });
    configureApplication(
      app,
      app.get(ConfigService).getOrThrow<AppConfig>('app'),
    );
    await app.init();
  });

  it('protects metrics, returns Prometheus text without an envelope, and does not self-observe', async () => {
    await request(app.getHttpServer()).get('/internal/metrics').expect(401);
    const response = await request(app.getHttpServer())
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
