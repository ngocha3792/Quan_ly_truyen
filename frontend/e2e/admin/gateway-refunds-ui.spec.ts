import { expect, test } from '@playwright/test';

const timestamp = '2026-09-24T09:12:00.000Z';

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    userEmail: 'khang@test.invalid',
    userDisplayName: 'Trần Minh Khang',
    packageLabel: 'Gói 500 Credit',
    provider: 'vietcombank',
    providerKind: 'MANUAL_BANK_TRANSFER',
    providerConfigurationReady: true,
    providerReference: 'TT240924001',
    creditAmount: '500',
    fiatAmountMinor: '2500000',
    currency: 'VND',
    status: 'PAID',
    transferClaim: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    settledAt: timestamp,
    ...overrides,
  };
}

test('gateway workspace records a manual refund and blocks it without proof', async ({ page }) => {
  const manualRefunds: { reason: string; transferReference: string }[] = [];
  await page.addInitScript(() =>
    localStorage.setItem('truyenhub.auth.has-refresh-session', 'true'),
  );

  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
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
        permissions: ['payment.read.admin', 'payment.refund.admin', 'payment.reconcile.admin'],
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
        paidOrders: 24,
        paidOrdersWithoutLedger: 2,
        orphanTopUpTransactions: 1,
        pendingExpiredOrders: 3,
        awaitingReviewOrders: 8,
        awaitingReviewOlderThan24h: 1,
        awaitingReviewAmountMinor: '18450000',
        confirmedToday: 31,
      });

    if (path.endsWith('/admin/billing/payment-orders'))
      return ok({
        items: [
          order(),
          order({
            id: '44444444-4444-4444-8444-444444444444',
            userDisplayName: 'Lê Thu Hà',
            provider: 'vnpay',
            providerKind: 'VNPAY',
            providerReference: 'VNP240924002',
            fiatAmountMinor: '320000',
            creditAmount: '60',
          }),
        ],
        pagination: { page: 1, pageSize: 10, totalItems: 24, totalPages: 3 },
      });

    if (path.includes('/refunds/manual')) {
      manualRefunds.push(
        route.request().postDataJSON() as { reason: string; transferReference: string },
      );
      return ok({ id: 'refund-1', status: 'COMPLETED' });
    }

    return ok(null);
  });

  // Bootstrap a client-only route before navigating: page.route cannot intercept SSR fetches.
  await page.goto('/tim-kiem');
  await expect(page.getByRole('heading', { name: 'Tìm kiếm', exact: true })).toBeVisible();
  await page.evaluate(() => {
    history.pushState(null, '', '/admin/payments/gateway');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page.getByRole('heading', { name: 'Đối soát và hoàn tiền' })).toBeVisible();
  await expect(page.getByText('đã thu tiền nhưng chưa cộng Credit')).toBeVisible();

  // Đơn chuyển khoản tay phải nói rõ là cổng không có API, thay vì để bấm rồi lỗi.
  const manualRow = page.getByRole('row').filter({ hasText: 'TT240924001' });
  await expect(manualRow.getByText('thủ công')).toBeVisible();

  await manualRow.getByRole('button', { name: 'Hoàn tiền đơn TT240924001' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Ghi nhận chuyển trả thủ công')).toBeVisible();

  const submit = dialog.getByRole('button', { name: 'Ghi nhận đã chuyển trả' });
  // Thiếu mã chuyển trả là API sẽ từ chối, nên nút phải khoá từ trước.
  await dialog.getByRole('textbox').last().fill('Người dùng nạp nhầm gói, đã thống nhất hoàn.');
  await expect(submit).toBeDisabled();

  await dialog.getByRole('textbox').first().fill('FT24268999111');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect.poll(() => manualRefunds.length).toBe(1);
  expect(manualRefunds[0].transferReference).toBe('FT24268999111');
});
