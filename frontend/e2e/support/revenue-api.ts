import { BrowserContext } from '@playwright/test';
import { mockAuthorEditorApi } from './author-studio-editor-api';

export const REVENUE_ACCOUNT_ID = '44444444-4444-4444-8444-444444444444';
export const REVENUE_REQUEST_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const timestamp = '2026-09-10T00:00:00.000Z';

export async function mockRevenueApi(context: BrowserContext) {
  await mockAuthorEditorApi(context);
  const writes: { path: string; body: Record<string, unknown>; key?: string }[] = [];
  const policy = {
    enabled: true,
    version: 1,
    settlementDelayDays: 7,
    minimumPayoutCredits: '100',
    feeBasisPoints: 500,
    taxBasisPoints: 1000,
    fiatMinorPerCredit: '2500',
    minimumPlatformFeeBasisPoints: 3000,
    platformUserId: USER_ID,
    currency: 'VND',
  };
  const account = {
    id: REVENUE_ACCOUNT_ID,
    userId: USER_ID,
    method: 'BANK_TRANSFER',
    bankName: 'Vietcombank',
    accountName: 'Nguyen Van A',
    accountNumberMasked: '••••1234',
    walletPhoneMasked: null,
    isVerified: true,
    isPrimary: true,
    isActive: true,
    kycReference: 'KYC-REVIEW-001',
  };
  let status = 'PENDING';
  const request = () => ({
    id: REVENUE_REQUEST_ID,
    userId: USER_ID,
    batchId: null,
    grossAmount: '1001',
    feeAmount: '50',
    taxAmount: '100',
    netAmount: '851',
    fiatMinorPerCredit: '2500',
    fiatAmountMinor: '2127500',
    status,
    createdAt: timestamp,
    completedAt: null,
    failureReason: null,
  });
  await context.route('**/api/v1/**', async (route) => {
    const http = route.request();
    const path = new URL(http.url()).pathname;
    const method = http.method();
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === '/api/v1/auth/me')
      return ok({
        id: USER_ID,
        email: 'revenue@test.invalid',
        username: 'revenue',
        displayName: 'Tác giả kiểm thử',
        emailVerified: true,
        roles: ['author', 'admin'],
        permissions: ['story.create', 'wallet.read.self', 'payment.order.settle.admin'],
        sessionId: 'revenue-test',
        status: 'ACTIVE',
        avatar: null,
        authorProfile: null,
      });
    if (path === '/api/v1/author/dashboard')
      return ok({
        profile: {
          displayName: 'Tác giả kiểm thử',
          penName: 'Tác giả',
          avatarUrl: '',
          verified: true,
        },
        unreadNotifications: 0,
        metrics: [],
        readership: { '7d': [], '30d': [], '90d': [] },
        schedule: [],
        stories: [],
        drafts: [],
        comments: [],
        topStories: [],
        monthlyGoals: [],
      });
    if (!path.includes('/revenue/')) return route.fallback();
    if (method !== 'GET') {
      writes.push({
        path,
        body: http.postDataJSON() as Record<string, unknown>,
        key: http.headers()['x-idempotency-key'],
      });
      if (path.endsWith('/payout-batches')) status = 'PROCESSING';
      if (path.endsWith('/complete')) status = 'COMPLETED';
      if (path.endsWith('/cancel')) status = 'CANCELLED';
      return ok(path.endsWith('/policy') ? policy : request());
    }
    if (path.endsWith('/earnings'))
      return ok({
        available: '5000',
        pending: '700',
        reserved: '0',
        paid: '10000',
        items: [],
        policy,
      });
    if (path.endsWith('/policy')) return ok(policy);
    if (path.endsWith('/payout-accounts')) return ok({ items: [account] });
    if (path.endsWith('/payout-requests')) return ok({ items: [request()] });
    if (path.endsWith('/payout-batches')) return ok({ items: [] });
    if (path.endsWith('/reconciliation'))
      return ok({
        purchaseGrossCredits: '5000',
        allocatedGrossCredits: '5000',
        refundedCredits: '0',
        earningsCredits: '5000',
        paidCredits: '0',
        differenceCredits: '0',
        generatedAt: timestamp,
      });
    if (path.endsWith('/agreements')) return ok([]);
    return ok(null);
  });
  return { writes };
}
