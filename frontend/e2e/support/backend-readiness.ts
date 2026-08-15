import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:3000';
const DEFAULT_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_INTERVAL_MS = 500;

export async function waitForBackendReady(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const backendUrl = (process.env['E2E_BACKEND_URL'] ?? DEFAULT_BACKEND_URL).replace(/\/+$/u, '');
  const readinessUrl = `${backendUrl}/api/v1/health/ready`;
  const deadline = Date.now() + timeoutMs;
  let lastFailure = 'backend chưa phản hồi';

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(readinessUrl, {
        headers: {
          accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (response.ok) {
        return;
      }

      const body = (await response.text()).trim();
      lastFailure = `HTTP ${response.status}${body ? `: ${body.slice(0, 500)}` : ''}`;
    } catch (error: unknown) {
      lastFailure = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(requestTimeout);
    }

    await delay(RETRY_INTERVAL_MS);
  }

  throw new Error(
    [
      `Backend E2E chưa ready sau ${timeoutMs}ms.`,
      `Endpoint: ${readinessUrl}`,
      `Lỗi gần nhất: ${lastFailure}`,
    ].join('\n'),
  );
}
