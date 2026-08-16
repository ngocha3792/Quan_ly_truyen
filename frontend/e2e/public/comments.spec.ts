import { expect, test } from '../fixtures/public-story-test';

const PASSWORD = 'E2eComment@2026';
const SESSION_HINT_KEY = 'truyenhub.auth.has-refresh-session';
const STORY_URL = '/truyen/e2e-public-story';
const ROOT_BODY = 'E2E root thread integrity comment';
const REPLY_BODY = 'E2E depth one reply';
const DEPTH_TWO_BODY = 'E2E depth two reply';

const USERS = {
  a: 'e2e.comment-a@truyenhub.test',
  b: 'e2e.comment-b@truyenhub.test',
  c: 'e2e.comment-c@truyenhub.test',
} as const;

test('reader thread, reaction, report and deleted tombstone journey stays consistent', async ({ page }, testInfo) => {
  await login(page, USERS.a, `${testInfo.title}-a`);
  await page.goto(STORY_URL);
  const comments = page.locator('app-public-comments');
  await comments.getByPlaceholder('Viết bình luận của bạn...').fill(ROOT_BODY);
  await comments.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(comments.getByText(ROOT_BODY)).toBeVisible();

  await switchUser(page, USERS.b, `${testInfo.title}-b`);
  await page.goto(STORY_URL);
  let rootThread = comments.locator('.comment-thread').filter({ hasText: ROOT_BODY });
  await rootThread.getByRole('button', { name: 'Phản hồi', exact: true }).first().click();
  await rootThread.getByPlaceholder('Viết phản hồi...').fill(REPLY_BODY);
  await rootThread.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
  let reply = rootThread.locator('.comment-item.reply').filter({ hasText: REPLY_BODY });
  await expect(reply).toBeVisible();

  await reply.getByRole('button', { name: /👍/ }).click();
  await reply.getByRole('button', { name: /❤️/ }).click();
  await expect(reply.getByRole('button', { name: /❤️/ })).toHaveClass(/active/);

  await page.reload();
  rootThread = comments.locator('.comment-thread').filter({ hasText: ROOT_BODY });
  await rootThread.getByRole('button', { name: /Xem 1 phản hồi/ }).click();
  reply = rootThread.locator('.comment-item.reply').filter({ hasText: REPLY_BODY });
  await expect(reply.getByRole('button', { name: /❤️/ })).toHaveClass(/active/);
  await reply.getByRole('button', { name: /❤️/ }).click();
  await expect(reply.getByRole('button', { name: /❤️/ })).not.toHaveClass(/active/);

  await switchUser(page, USERS.a, `${testInfo.title}-a2`);
  await page.goto(STORY_URL);
  rootThread = comments.locator('.comment-thread').filter({ hasText: ROOT_BODY });
  await rootThread.getByRole('button', { name: /Xem 1 phản hồi/ }).click();
  reply = rootThread.locator('.comment-item.reply').filter({ hasText: REPLY_BODY });
  await reply.getByRole('button', { name: 'Phản hồi', exact: true }).click();
  await rootThread.getByPlaceholder('Viết phản hồi...').fill(DEPTH_TWO_BODY);
  await rootThread.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
  const depthTwo = rootThread.locator('.comment-item.reply.depth-two').filter({ hasText: DEPTH_TWO_BODY });
  await expect(depthTwo).toBeVisible();
  await expect(depthTwo.getByRole('button', { name: 'Phản hồi', exact: true })).toHaveCount(0);

  await switchUser(page, USERS.c, `${testInfo.title}-c`);
  await page.goto(STORY_URL);
  rootThread = comments.locator('.comment-thread').filter({ hasText: ROOT_BODY });
  await rootThread.getByRole('button', { name: /Xem 2 phản hồi/ }).click();
  reply = rootThread.locator('.comment-item.reply').filter({ hasText: REPLY_BODY });
  await reply.getByRole('button', { name: 'Báo cáo', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').selectOption('HARASSMENT');
  await dialog.getByRole('textbox').fill('Phản hồi này có nội dung quấy rối cần moderator xem xét.');
  await dialog.getByRole('button', { name: 'Gửi báo cáo', exact: true }).click();
  await expect(comments.getByText('Cảm ơn bạn đã báo cáo. Nhóm kiểm duyệt sẽ xem xét.')).toBeVisible();

  await switchUser(page, USERS.a, `${testInfo.title}-a3`);
  await page.goto(STORY_URL);
  rootThread = comments.locator('.comment-thread').filter({ hasText: ROOT_BODY });
  await rootThread.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(comments.getByText('Bình luận này đã bị xóa.')).toBeVisible();
  rootThread = comments.locator('.comment-thread').filter({ hasText: 'Bình luận này đã bị xóa.' });
  await rootThread.getByRole('button', { name: /Xem 2 phản hồi/ }).click();
  await expect(rootThread.getByText(REPLY_BODY)).toBeVisible();
  await expect(rootThread.getByText(DEPTH_TWO_BODY)).toBeVisible();
});

async function switchUser(page: import('@playwright/test').Page, email: string, device: string): Promise<void> {
  await logout(page);
  await login(page, email, device);
}

async function login(page: import('@playwright/test').Page, email: string, device: string): Promise<void> {
  const response = await page.request.post('/api/v1/auth/login', {
    data: {
      identifier: email,
      password: PASSWORD,
      deviceName: `Playwright Comment - ${device}`,
      deviceId: `playwright-comment-${device.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}`,
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), SESSION_HINT_KEY);
}

async function logout(page: import('@playwright/test').Page): Promise<void> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((cookie) => cookie.name === 'csrf_token');
  if (csrf) {
    await page.request.post('/api/v1/auth/logout', { headers: { 'x-csrf-token': csrf.value } });
  }
  await page.evaluate(() => window.localStorage.clear()).catch(() => undefined);
  await page.context().clearCookies();
}
