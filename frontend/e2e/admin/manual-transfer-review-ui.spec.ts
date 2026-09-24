import { expect, test } from '@playwright/test';

const timestamp = '2026-09-24T09:12:00.000Z';
const overdueAt = '2026-09-20T02:00:00.000Z';

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    userEmail: 'khang@test.invalid',
    userDisplayName: 'Trần Minh Khang',
    packageLabel: 'Gói 500 Credit',
    provider: 'vietcombank',
    providerReference: 'CK240924-001',
    creditAmount: '500',
    fiatAmountMinor: '2500000',
    currency: 'VND',
    status: 'AWAITING_REVIEW',
    transferClaim: { referenceCode: 'FT24268123456', note: 'Nap 0945' },
    createdAt: timestamp,
    settledAt: null,
    ...overrides,
  };
}

test('manual transfer review workspace shows the queue and asks for a reason before settling', async ({
  page,
}) => {
  const confirmed: { reason: string }[] = [];
  await page.addInitScript(() =>
    localStorage.setItem('truyenhub.auth.has-refresh-session', 'true'),
  );

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });

    if (path.endsWith('/auth/client-config'))
      return ok({
        features: {
          monetizationEnabled: true,
          paymentProviderEnabled: true,
          contentDocumentEnabled: true,
          portableCursorEnabled: false,
          realtimeProgressSyncEnabled: false,
          inlineCommentsEnabled: false,
          comicDeliveryEnabled: false,
          offlineReadingEnabled: false,
          textToSpeechEnabled: false,
        },
        passwordPolicy: {
          minimumLength: 8,
          maximumLength: 72,
          maximumBytes: 72,
          requireLowercase: true,
          requireUppercase: true,
          requireNumber: true,
          requireSymbol: true,
        },
        passwordReset: { tokenExpiresInMinutes: 15 },
        csrf: { enabled: false, cookieName: 'csrf', headerName: 'x-csrf-token' },
      });

    if (path.endsWith('/auth/refresh'))
      return ok({
        sessionId: 'admin-test',
        accessToken: 'admin-test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2099-01-01T00:00:00.000Z',
      });

    if (path.endsWith('/auth/me'))
      return ok({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'admin@test.invalid',
        username: 'admin',
        displayName: 'Nguyễn Văn Hoàng',
        emailVerified: true,
        roles: ['admin'],
        permissions: ['payment.order.settle.admin', 'payment.read.admin'],
        sessionId: 'admin-test',
        bio: null,
        status: 'ACTIVE',
        emailVerifiedAt: timestamp,
        lastLoginAt: timestamp,
        avatar: null,
        authorProfile: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    if (path.endsWith('/admin/billing/reconciliation'))
      return ok({
        paidOrders: 120,
        paidOrdersWithoutLedger: 0,
        orphanTopUpTransactions: 0,
        pendingExpiredOrders: 4,
        awaitingReviewOrders: 18,
        awaitingReviewOlderThan24h: 3,
        awaitingReviewAmountMinor: '42500000',
        confirmedToday: 27,
      });

    if (path.endsWith('/admin/billing/payment-orders'))
      return ok({
        items: [
          order(),
          order({
            id: '44444444-4444-4444-8444-444444444444',
            userDisplayName: 'Lê Thu Hà',
            provider: 'mbbank',
            fiatAmountMinor: '500000',
            creditAmount: '100',
            createdAt: overdueAt,
            transferClaim: { referenceCode: 'FT24264000001', note: 'Nap tien 1832' },
          }),
        ],
        pagination: { page: 1, pageSize: 10, totalItems: 18, totalPages: 2 },
      });

    if (path.includes('/confirm')) {
      confirmed.push(route.request().postDataJSON() as { reason: string });
      return ok({ id: '11111111-1111-4111-8111-111111111111', status: 'PAID' });
    }

    return ok(null);
  });

  // Bootstrap a client-only route before navigating: page.route cannot intercept SSR fetches.
  await page.goto('/tim-kiem');
  await expect(page.getByRole('heading', { name: 'Tìm kiếm', exact: true })).toBeVisible();
  await page.evaluate(() => {
    history.pushState(null, '', '/admin/payments/review');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page.getByRole('heading', { name: 'Đơn chuyển khoản chờ xác nhận' })).toBeVisible();

  // Bốn số liệu đều đến từ API đối soát, không tính lại ở client.
  await expect(page.getByText('42.500.000', { exact: true })).toBeVisible();
  await expect(page.getByText('đơn đã chờ quá 24 giờ')).toBeVisible();
  await expect(page.getByText('đơn được cộng Credit hôm nay')).toBeVisible();

  const row = page.getByRole('row').filter({ hasText: 'FT24268123456' });
  await expect(row).toBeVisible();
  await expect(row.getByText('Trần Minh Khang')).toBeVisible();

  await row.getByRole('button', { name: 'Xác nhận đơn FT24268123456' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Lý do dưới 10 ký tự là API sẽ từ chối, nên nút phải khoá từ trước.
  const submit = dialog.getByRole('button', { name: 'Xác nhận và cộng Credit' });
  await expect(submit).toBeDisabled();

  await dialog.getByRole('textbox').fill('Đã đối chiếu sao kê Vietcombank, số tiền khớp.');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect.poll(() => confirmed.length).toBe(1);
  expect(confirmed[0].reason).toBe('Đã đối chiếu sao kê Vietcombank, số tiền khớp.');
});
