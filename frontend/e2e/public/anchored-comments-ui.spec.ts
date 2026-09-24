import { expect, test } from '@playwright/test';

const storyId = '38f2a766-8968-49d0-a483-cbefd481dd30';
const chapterId = '5c41eb9b-5b5b-40df-af6d-caf254123588';
const firstId = 'a8daca54-79ea-48a3-8831-8be27492859f';
const secondId = 'e0d5a849-f878-4a3d-8588-276ad7a8de6a';
const quote =
  'Quả nhiên không lâu sau, tiếng bước chân lẹp xẹp vang lên từ xa. Kiyotaka đứng thẳng dậy.';
const timestamp = '2026-09-09T16:56:27.104Z';

test('reader submits source-relative offsets when selection ends at the next paragraph', async ({
  page,
}) => {
  const submissions: unknown[] = [];
  await page.addInitScript(() =>
    localStorage.setItem('truyenhub.auth.has-refresh-session', 'true'),
  );
  // Keep this DOM/payload regression independent of database seeds and feature flags.
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === '/api/v1/search/filters') return ok({ categories: [], tags: [] });
    if (path === '/api/v1/reader-analytics/config') return ok({ enabled: false });
    if (path.endsWith('/auth/client-config'))
      return ok({
        features: {
          monetizationEnabled: false,
          paymentProviderEnabled: false,
          contentDocumentEnabled: true,
          portableCursorEnabled: false,
          realtimeProgressSyncEnabled: false,
          inlineCommentsEnabled: true,
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
        sessionId: 'reader-test',
        accessToken: 'reader-test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
    if (path.endsWith('/auth/me'))
      return ok({
        id: 'reader-test',
        email: 'reader@test.invalid',
        username: 'reader',
        displayName: 'Bạn đọc',
        emailVerified: true,
        roles: ['user'],
        permissions: [],
        sessionId: 'reader-test',
        bio: null,
        status: 'ACTIVE',
        emailVerifiedAt: timestamp,
        lastLoginAt: timestamp,
        avatar: null,
        authorProfile: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    if (path === '/api/v1/stories/anchor-test/chapters/1')
      return ok({
        story: { id: storyId, slug: 'anchor-test', title: 'Truyện kiểm thử' },
        chapter: {
          id: chapterId,
          number: 1,
          title: 'Đoạn văn kiểm thử',
          slug: 'doan-van',
          wordCount: 30,
          views: 0,
          comments: 0,
          publishedAt: timestamp,
          updatedAt: timestamp,
          access: { state: 'FREE', priceCredits: null },
          content: `${quote}\n\nĐoạn văn tiếp theo.`,
          contentFormat: 'MARKDOWN',
          contentDocument: {
            schemaVersion: 1,
            blocks: [
              { id: firstId, type: 'paragraph', text: quote },
              { id: secondId, type: 'paragraph', text: 'Đoạn văn tiếp theo.' },
            ],
          },
          documentSchemaVersion: 1,
        },
        navigation: { previous: null, next: null },
      });
    if (path === `/api/v1/stories/${storyId}/chapters/${chapterId}/anchored-comments`) {
      const input = route.request().postDataJSON();
      submissions.push(input);
      return ok({
        id: 'comment-test',
        storyId,
        chapterId,
        parentId: null,
        depth: 0,
        body: input.body,
        displayState: 'VISIBLE',
        user: { id: 'reader-test', displayName: 'Bạn đọc', avatarUrl: null },
        likeCount: 0,
        reactions: { LIKE: 0, DISLIKE: 0, LAUGH: 0, SAD: 0, ANGRY: 0 },
        replyCount: 0,
        threadReplyCount: 0,
        editedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        anchor: { ...input.anchor, status: 'ACTIVE', chapterVersion: 1 },
        region: null,
      });
    }
    if (path.endsWith('/comments'))
      return ok({ items: [], pagination: { totalItems: 0, page: 1, pageSize: 20, totalPages: 0 } });
    return ok(null);
  });

  // Bootstrap a client-only route before navigating: page.route cannot intercept SSR fetches.
  await page.goto('/tim-kiem');
  await expect(page.getByRole('heading', { name: 'Tìm kiếm', exact: true })).toBeVisible();
  await page.evaluate(() => {
    history.pushState(null, '', '/truyen/anchor-test/chuong/1');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const first = page.locator(`[data-block-id="${firstId}"]`);
  await expect(first).toBeVisible();
  // Exact textContent catches whitespace introduced by Angular's real reader template.
  expect(await first.textContent()).toBe(quote);
  await first.scrollIntoViewIfNeeded();
  await page.evaluate(
    ({ firstId, secondId }) => {
      const first = document.querySelector(`[data-block-id="${firstId}"]`)!;
      const second = document.querySelector(`[data-block-id="${secondId}"]`)!;
      const range = document.createRange();
      range.setStart(first.firstChild!, 0);
      range.setEnd(second, 0);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      first.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    },
    { firstId, secondId },
  );
  await page.getByRole('button', { name: 'Bình luận đoạn này', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Bình luận theo đoạn' });
  await panel.getByPlaceholder('Viết bình luận...').fill('test');
  await panel.getByRole('button', { name: 'Đăng bình luận', exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toEqual({
    body: 'test',
    anchor: {
      startBlockId: firstId,
      startOffset: 0,
      endBlockId: firstId,
      endOffset: quote.length,
      quoteText: quote,
    },
  });
  await expect(panel.locator('.threads').getByText('test', { exact: true })).toBeVisible();
});
