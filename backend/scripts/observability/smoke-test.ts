import 'dotenv/config';

const baseUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:3000';
const metricsToken = process.env.METRICS_BEARER_TOKEN;

async function request(
  path: string,
  expectedStatus: number,
): Promise<Response> {
  const response = await fetch(`${baseUrl}${path}`);
  if (response.status !== expectedStatus) {
    throw new Error(
      `${path} returned ${response.status}, expected ${expectedStatus}`,
    );
  }
  return response;
}

async function main(): Promise<void> {
  const health = await request('/api/v1/health/live', 200);
  const success = await request('/api/v1', 200);
  const notFound = await request('/api/v1/observability-smoke-not-found', 404);
  const metrics = await fetch(`${baseUrl}/internal/metrics`, {
    headers: metricsToken ? { authorization: `Bearer ${metricsToken}` } : {},
  });
  if (!metrics.ok) throw new Error(`metrics returned ${metrics.status}`);
  const body = await metrics.text();
  for (const name of [
    'qlt_http_server_requests_total',
    'qlt_http_server_request_duration_seconds',
    'qlt_outbox_backlog_events',
  ]) {
    if (!body.includes(name)) throw new Error(`metric ${name} is missing`);
  }
  process.stdout.write(
    `${JSON.stringify({
      event: 'observability.smoke.passed',
      requestIds: [health, success, notFound].map((response) =>
        response.headers.get('x-request-id'),
      ),
      traceIds: [health, success, notFound].map((response) =>
        response.headers.get('x-trace-id'),
      ),
    })}\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      event: 'observability.smoke.failed',
      'error.type': error instanceof Error ? error.name : 'UnknownError',
    })}\n`,
  );
  process.exitCode = 1;
});
