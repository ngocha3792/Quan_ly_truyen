import { ConfigService } from '@nestjs/config';

import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  const config = new ConfigService({
    observability: {
      enabled: true,
      serviceName: 'test-service',
      metrics: { enabled: true, collectDefaultMetrics: false },
    },
  });

  it('uses seconds and bounded route labels for HTTP metrics', async () => {
    const service = new MetricsService(config);
    service.recordHttpStart('get');
    service.recordHttpFinish({
      method: 'get',
      route: '/api/v1/stories/:id',
      statusCode: 200,
      durationSeconds: 0.25,
    });
    const rendered = await service.render();
    expect(rendered).toContain(
      'qlt_http_server_requests_total{method="GET",route="/api/v1/stories/:id",status_code="200",service="test-service"} 1',
    );
    expect(rendered).toContain('qlt_http_server_request_duration_seconds_sum');
    expect(rendered).toContain(' 0.25');
    expect(rendered).toContain(
      'qlt_http_server_active_requests{method="GET",service="test-service"} 0',
    );
  });

  it('normalizes unbounded metric dimensions', async () => {
    const service = new MetricsService(config);
    service.recordOutbox('user-controlled-event', 'failed', 0.1);
    service.recordMail('user-controlled-template', 'failed', 0.1);
    service.recordWebhook('user-controlled-webhook', 'failed');
    const rendered = await service.render();
    expect(rendered).not.toContain('user-controlled');
    expect(rendered).toContain('event_type="unknown"');
    expect(rendered).toContain('template="unknown"');
  });

  it('creates an isolated registry without duplicate registration', () => {
    expect(() => new MetricsService(config)).not.toThrow();
    expect(() => new MetricsService(config)).not.toThrow();
  });
});
