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

  it('keeps weekly recap mail as a bounded observable template', async () => {
    const service = new MetricsService(config);
    service.recordMail('weekly-reading-recap.v1', 'success', 0.2);

    const rendered = await service.render();

    expect(rendered).toContain('template="weekly-reading-recap.v1"');
  });

  it('records audit reads with bounded operation/result labels only', async () => {
    const service = new MetricsService(config);
    service.recordAuditLogRead('list', 'success');
    service.recordAuditLogRead('detail', 'error');
    const rendered = await service.render();
    expect(rendered).toContain(
      'qlt_audit_log_read_requests_total{operation="list",result="success"',
    );
    expect(rendered).toContain(
      'qlt_audit_log_read_requests_total{operation="detail",result="error"',
    );
  });

  it('creates an isolated registry without duplicate registration', () => {
    expect(() => new MetricsService(config)).not.toThrow();
    expect(() => new MetricsService(config)).not.toThrow();
  });

  it('records auth access session database lookup latency', async () => {
    const service = new MetricsService(config);

    service.recordAuthAccessSessionDbLookup('found', 0.012);

    service.recordAuthAccessSessionDbLookup('not_found', 0.004);

    const rendered = await service.render();

    expect(rendered).toContain(
      'qlt_auth_access_session_db_lookup_duration_seconds',
    );

    expect(rendered).toContain('result="found"');

    expect(rendered).toContain('result="not_found"');

    expect(rendered).toContain(
      'qlt_auth_access_session_db_lookup_duration_seconds_count',
    );
  });

  it('publishes bounded reader analytics health gauges', async () => {
    const service = new MetricsService(config);

    service.setReaderAnalyticsHealth({
      enabled: true,
      backlogEvents: 4,
      oldestUnprocessedAgeSeconds: 125,
      reconciliationHealthy: false,
      reconciliationAgeSeconds: 901,
    });

    const rendered = await service.render();
    expect(rendered).toContain(
      'qlt_reader_analytics_enabled{service="test-service"} 1',
    );
    expect(rendered).toContain(
      'qlt_reader_analytics_backlog_events{service="test-service"} 4',
    );
    expect(rendered).toContain(
      'qlt_reader_analytics_oldest_unprocessed_age_seconds{service="test-service"} 125',
    );
    expect(rendered).toContain(
      'qlt_reader_analytics_reconciliation_healthy{service="test-service"} 0',
    );
    expect(rendered).toContain(
      'qlt_reader_analytics_reconciliation_age_seconds{service="test-service"} 901',
    );
    expect(rendered).toContain(
      'qlt_reader_analytics_metrics_snapshot_healthy{service="test-service"} 1',
    );

    service.setReaderAnalyticsSnapshotHealthy(false);
    expect(await service.render()).toContain(
      'qlt_reader_analytics_metrics_snapshot_healthy{service="test-service"} 0',
    );
  });

  it('publishes rollout and financial integrity gauges', async () => {
    const service = new MetricsService(config);
    service.setMonetizationRollout({ enabled: true, stage: 'story_allowlist' });
    service.setMonetizationFinancialIntegrity({
      ledger_balance: 0,
      wallet_balance: 1,
      chapter_purchase: 0,
      payment_order: 0,
    });

    const rendered = await service.render();
    expect(rendered).toContain(
      'qlt_monetization_enabled{service="test-service"} 1',
    );
    expect(rendered).toContain(
      'qlt_monetization_rollout_stage{stage="story_allowlist",service="test-service"} 1',
    );
    expect(rendered).toContain(
      'qlt_monetization_financial_integrity_mismatches{check="wallet_balance",service="test-service"} 1',
    );
    expect(rendered).toContain(
      'qlt_monetization_integrity_snapshot_healthy{service="test-service"} 1',
    );
    service.setPaymentWebhookBacklog({
      pending: 2,
      processing: 1,
      failed: 3,
      oldestPendingAgeSeconds: 90,
    });
    expect(await service.render()).toContain(
      'qlt_payment_webhook_backlog_events{status="failed",service="test-service"} 3',
    );
  });
});
