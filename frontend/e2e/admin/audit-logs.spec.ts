import { expect, test } from '../fixtures/managed-admin-test';

const CORRELATION_REQUEST = 'e2e-audit-correlation-request';
const UNSAFE_REQUEST = 'e2e-audit-secret-regression-request';
const SECRETS = ['DO_NOT_LEAK_1', 'DO_NOT_LEAK_2', 'DO_NOT_LEAK_3', 'DO_NOT_LEAK_4'];

test('manager can investigate user lifecycle and correlate the same request', async ({ page }) => {
  await page.goto(`/admin/audit-logs?requestId=${CORRELATION_REQUEST}`);
  await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible();

  const userRow = page.getByRole('row').filter({ hasText: 'user.status.changed' });
  await expect(userRow).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'user.sessions.revoked' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'comment.moderation.hidden' })).toBeVisible();

  await userRow.getByRole('link', { name: 'Xem' }).click();
  await expect(page.getByRole('heading', { name: 'user.status.changed' })).toBeVisible();
  await expect(page.getByText('Before')).toBeVisible();
  await expect(page.getByText('ACTIVE', { exact: true })).toBeVisible();
  await expect(page.getByText('SUSPENDED', { exact: true })).toBeVisible();
  await expect(page.getByText('203.0.113.xxx')).toBeVisible();

  await page.getByRole('link', { name: CORRELATION_REQUEST }).click();
  await expect(page).toHaveURL(new RegExp(`requestId=${CORRELATION_REQUEST}`));
  await expect(page.getByRole('row').filter({ hasText: 'user.sessions.revoked' })).toBeVisible();
});

test('historical unsafe audit payload is redacted in both network response and DOM', async ({ page }) => {
  await page.goto(`/admin/audit-logs?requestId=${UNSAFE_REQUEST}`);
  const row = page.getByRole('row').filter({ hasText: 'audit.security.regression' });
  await expect(row).toBeVisible();

  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/admin/audit-logs/') && response.request().method() === 'GET',
  );
  await row.getByRole('link', { name: 'Xem' }).click();
  const response = await responsePromise;
  const body = await response.text();
  for (const secret of SECRETS) expect(body).not.toContain(secret);
  expect(body).toContain('[REDACTED]');

  await expect(page.locator('pre').filter({ hasText: '[REDACTED]' }).first()).toBeVisible();
  const html = await page.locator('body').innerText();
  for (const secret of SECRETS) expect(html).not.toContain(secret);
});
