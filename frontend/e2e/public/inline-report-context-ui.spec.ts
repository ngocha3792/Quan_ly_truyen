import { expect, test } from '@playwright/test';
import { mockAuthorEditorApi } from '../support/author-studio-editor-api';

test('admin inbox preserves the anchored snapshot while showing an edited comment', async ({
  page,
  context,
}) => {
  // Reuse the existing isolated auth/runtime mock; every request stays local.
  await mockAuthorEditorApi(context);
  const timestamp = '2026-09-09T00:00:00Z';
  const user = { id: 'report-reviewer', displayName: 'Moderator', email: 'moderator@test.invalid' };
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...user,
          username: 'moderator',
          roles: ['ADMIN'],
          permissions: ['report.review'],
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: timestamp,
          lastLoginAt: timestamp,
          sessionId: 'report-session',
          bio: null,
          avatar: null,
          authorProfile: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    }),
  );
  const anchorContext = {
    blockId: 'original-block',
    quote: '<script>Quote from the original chapter</script>',
    chapterVersion: 2,
    reportedChapterVersion: 4,
    lastVerifiedVersion: 3,
    status: 'ORPHANED',
    rootCommentId: 'root',
  };
  const report = {
    id: 'report',
    reason: 'SPAM',
    status: 'OPEN',
    createdAt: timestamp,
    reporter: user,
    reportedUser: user,
    story: { id: 'story', title: 'Truyện thử nghiệm', slug: 'truyen-thu-nghiem' },
    chapter: { id: 'chapter', title: 'Chương thử nghiệm', number: 1 },
    comment: { id: 'reply', excerpt: 'Reported reply' },
    anchorContext,
  };
  await context.route('**/api/v1/admin/reports**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/report')
      ? {
          ...report,
          description: null,
          updatedAt: timestamp,
          resolvedAt: null,
          resolutionNote: null,
          evidence: { comment: { body: 'Original reported reply' } },
          currentComment: {
            id: 'reply',
            body: 'Edited reply',
            moderationStatus: 'VISIBLE',
            createdAt: timestamp,
            editedAt: '2026-09-09T01:00:00Z',
            deletedAt: null,
            user: { ...user, status: 'ACTIVE' },
          },
          relatedReportCount: 1,
          recentUserModerationCount: 0,
          moderationActions: [],
        }
      : { items: [report], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } };
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/admin/reports');
  await expect(page.getByRole('heading', { name: 'Báo cáo bình luận' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Reported reply' });
  await expect(row).toContainText('Bình luận theo đoạn · v2');
  await row.getByRole('link', { name: 'Xem', exact: true }).click();
  const snapshot = page.getByRole('region', { name: 'Bối cảnh bình luận theo đoạn' });
  await expect(snapshot).toContainText('v2');
  await expect(snapshot).toContainText('v4');
  await expect(snapshot).toContainText('Không còn khớp');
  await expect(snapshot.locator('blockquote')).toHaveText(anchorContext.quote);
  await expect(snapshot.locator('script')).toHaveCount(0);
  await expect(page.getByText('Đã chỉnh sửa sau khi bị báo cáo')).toBeVisible();
  await page.reload();
  await expect(snapshot.locator('blockquote')).toHaveText(anchorContext.quote);
});
