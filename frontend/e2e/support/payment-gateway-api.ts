import { BrowserContext } from '@playwright/test';
import { mockAuthorEditorApi, STORY_ID } from './author-studio-editor-api';

export const PAYMENT_ID = '55555555-5555-4555-8555-555555555555';
export const PROVIDER_ID = '66666666-6666-4666-8666-666666666666';
export const PAYMENT_RETURN = `/tai-khoan/credit/ket-qua-thanh-toan?orderId=${PAYMENT_ID}`;

export async function mockPaymentGatewayApi(context: BrowserContext) {
  await mockAuthorEditorApi(context);
  const providerWrites: Record<string, unknown>[] = [];
  const refunds: Record<string, unknown>[] = [];
  const orderWrites: Record<string, unknown>[] = [];
  const methodsQueries: string[] = [];
  const rolloutWrites: Record<string, unknown>[] = [];
  let reconciliations = 0;
  let orderStatus = 'PENDING';
  let refundRows: Record<string, unknown>[] = [];
  let providers: Record<string, unknown>[] = [];
  let allowlist = { isEnabled: false, enabledProviders: [] as string[] };
  const schema = {
    kind: 'VNPAY',
    supportsWebhook: true,
    requiresManualReview: false,
    fields: [
      {
        name: 'environment',
        label: 'Môi trường',
        required: true,
        type: 'select',
        defaultValue: 'SANDBOX',
        options: [
          { value: 'SANDBOX', label: 'Sandbox' },
          { value: 'PRODUCTION', label: 'Production' },
        ],
      },
      { name: 'tmnCode', label: 'Mã đơn vị (TMN)', required: true },
      {
        name: 'returnUrl',
        label: 'URL quay lại',
        required: true,
        type: 'url',
        defaultValue: 'https://reader.example/tai-khoan/credit/ket-qua-thanh-toan',
      },
      { name: 'serverIp', label: 'IP máy chủ', required: true },
      {
        name: 'hashSecret',
        label: 'Khóa Hash Secret',
        required: true,
        type: 'password',
        secret: true,
      },
    ],
  };
  const order = () => ({
    id: PAYMENT_ID,
    packageId: 'package-1',
    provider: 'vnpay-test',
    providerKind: 'VNPAY',
    providerConfigurationReady: true,
    providerReference: 'reference-1',
    creditAmount: '100',
    fiatAmountMinor: '10000',
    currency: 'VND',
    status: orderStatus,
    userEmail: 'reader@example.test',
    userDisplayName: 'Độc giả',
    packageLabel: '100 Credit',
    checkoutUrl: null,
    fulfilment: { kind: 'none' },
    transferClaim: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    settledAt: null,
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
  });
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === '/api/v1/notifications')
      return ok({
        notifications: [],
        statistics: { total: 0, unread: 0, saved: 0, receivedToday: 0 },
        settings: {},
        recentActivities: [],
      });
    if (path === '/api/v1/auth/me')
      return ok({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'admin@example.test',
        username: 'admin',
        displayName: 'Admin kiểm thử',
        roles: ['admin'],
        permissions: [
          'payment.provider.manage.admin',
          'payment.read.admin',
          'payment.refund.admin',
          'payment.order.settle.admin',
          'payment.reconcile.admin',
        ],
        emailVerified: true,
        status: 'ACTIVE',
        avatar: null,
        authorProfile: null,
        sessionId: 'payment-test',
      });
    if (path.endsWith('/payment-providers/kinds')) return ok([schema]);
    if (path.includes('/admin/billing/payment-providers')) {
      if (request.method() === 'GET') return ok(providers);
      const input = request.postDataJSON() as Record<string, unknown>;
      providerWrites.push(input);
      const config = input['config'] as Record<string, string>;
      const credentials = input['credentials'] as Record<string, string> | undefined;
      const hasSecret =
        !!credentials?.['hashSecret'] ||
        !!(providers[0]?.['secretConfiguredFields'] as string[] | undefined)?.length;
      const missing = ['tmnCode', 'returnUrl', 'serverIp'].filter((name) => !config[name]);
      if (!hasSecret) missing.push('hashSecret');
      const { credentials: ignored, ...safe } = input;
      void ignored;
      const saved = {
        ...providers[0],
        ...safe,
        id: PROVIDER_ID,
        configurationReady: missing.length === 0,
        missingConfigurationFields: missing,
        secretConfiguredFields: hasSecret ? ['hashSecret'] : [],
        credentialsStorageAvailable: true,
        webhookUrl: 'https://reader.example/api/v1/webhooks/payments/vnpay-test/ipn',
        returnUrl: config['returnUrl'] ?? null,
      };
      providers = [saved];
      return ok(saved);
    }
    if (path.endsWith(`/story-allowlists/${STORY_ID}`)) {
      if (request.method() === 'PUT') {
        const input = request.postDataJSON() as typeof allowlist;
        rolloutWrites.push(input);
        allowlist = input;
      }
      return ok(allowlist);
    }
    if (path.endsWith('/payment-orders'))
      return ok({
        items: [order()],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
    if (path.endsWith('/reconcile')) {
      reconciliations += 1;
      return ok({
        status: orderStatus,
        providerStatus: '00',
        matched: true,
        message: 'Đã đối soát với VNPAY.',
      });
    }
    if (path.endsWith('/refunds')) {
      if (request.method() === 'POST') {
        refunds.push({
          ...request.postDataJSON(),
          idempotencyKey: request.headers()['x-idempotency-key'],
        });
        refundRows = [
          {
            id: 'refund-1',
            status: 'UNKNOWN',
            amountMinor: '10000',
            currency: 'VND',
            reason: request.postDataJSON().reason,
            providerRefundId: null,
            createdAt: '2026-09-09T00:00:00.000Z',
          },
        ];
        return ok(refundRows[0]);
      }
      return ok(refundRows);
    }
    if (path === '/api/v1/wallet/me')
      return ok({ currency: 'CREDIT', availableBalance: '0', version: 1, updatedAt: null });
    if (path.endsWith('/billing/credit-packages'))
      return ok([
        {
          id: 'package-1',
          code: 'credit-100',
          label: '100 Credit',
          creditAmount: '100',
          fiatAmountMinor: '10000',
          currency: 'VND',
          isActive: true,
          sortOrder: 1,
        },
      ]);
    if (path.endsWith('/billing/payment-methods')) {
      methodsQueries.push(url.searchParams.get('storyId') ?? '');
      return ok(
        url.searchParams.get('storyId') === STORY_ID
          ? [
              {
                id: PROVIDER_ID,
                code: 'vnpay-test',
                kind: 'VNPAY',
                displayName: 'VNPAY',
                description: null,
                currency: 'VND',
                sortOrder: 1,
              },
            ]
          : [],
      );
    }
    if (path.endsWith('/top-up-orders/me'))
      return ok({
        items: [order()],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      });
    if (path.endsWith(`/top-up-orders/${PAYMENT_ID}`)) return ok(order());
    if (path.endsWith('/top-up-orders')) {
      orderWrites.push(request.postDataJSON());
      return ok({
        order: { ...order(), fulfilment: { kind: 'redirect', checkoutUrl: PAYMENT_RETURN } },
        replayed: false,
      });
    }
    return route.fallback();
  });
  return {
    providerWrites,
    refunds,
    orderWrites,
    methodsQueries,
    rolloutWrites,
    reconciliations: () => reconciliations,
    settle: () => {
      orderStatus = 'PAID';
    },
  };
}
