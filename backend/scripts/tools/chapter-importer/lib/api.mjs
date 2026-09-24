import { randomUUID } from 'node:crypto';
import { readJsonBody, describeApiError, sleep } from './session.mjs';

const NETWORK_ERROR_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 6000];
// Transient server-side statuses worth retrying with the same idempotency
// key: request timeout, rate limit, and upstream/gateway hiccups. NOT 4xx
// validation errors — those are real and retrying them is pointless.
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

/**
 * Runs one mutating call through `session.authFetch`, reusing the SAME
 * idempotency key across retries. The backend's idempotency store replays
 * the original result for a repeated key+body instead of doing the work
 * twice, so retrying a network-level failure or a transient server error
 * (which may have actually succeeded server-side — the recurring
 * "terminated"/"fetch failed"/408 class of error seen against this VPS)
 * never creates a duplicate chapter/action.
 */
async function callWithIdempotentRetry(session, pathName, { method = 'POST', body, extraHeaders = {} } = {}) {
  const idempotencyKey = randomUUID();
  let lastError;

  for (let attempt = 0; attempt <= NETWORK_ERROR_RETRIES; attempt += 1) {
    try {
      const response = await session.authFetch(pathName, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          'x-idempotency-key': idempotencyKey,
          ...extraHeaders,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (RETRYABLE_STATUSES.has(response.status) && attempt < NETWORK_ERROR_RETRIES) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 6000);
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < NETWORK_ERROR_RETRIES) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 6000);
        continue;
      }
    }
  }
  throw lastError;
}

async function mutateAndParse(session, pathName, opts, actionLabel) {
  const response = await callWithIdempotentRetry(session, pathName, opts);
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw new Error(`${actionLabel} thất bại (${response.status}): ${describeApiError(body)}`);
  }
  return body?.data ?? body;
}

export async function listStories(authorSession) {
  const response = await authorSession.authFetch('/api/v1/author/stories');
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw new Error(`Lấy danh sách truyện thất bại (${response.status}): ${describeApiError(body)}`);
  }
  return body?.data ?? [];
}

export async function createStory(authorSession, title) {
  return mutateAndParse(authorSession, '/api/v1/author/stories', { body: { title } }, `Tạo truyện "${title}"`);
}

export async function submitStory(authorSession, storyId, authorNote) {
  return mutateAndParse(
    authorSession,
    `/api/v1/author/stories/${storyId}/submit`,
    { body: { authorNote: authorNote ?? 'Truyện mới, đăng đủ chương đầu.' } },
    'Submit truyện',
  );
}

export async function adminApproveStory(adminSession, submissionId) {
  return mutateAndParse(
    adminSession,
    `/api/v1/admin/story-submissions/${submissionId}/approve`,
    {},
    'Admin approve truyện',
  );
}

export async function listChapters(authorSession, storyId) {
  const response = await authorSession.authFetch(
    `/api/v1/author/stories/${storyId}/chapters?limit=1000`,
  );
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw new Error(`Lấy danh sách chương thất bại (${response.status}): ${describeApiError(body)}`);
  }
  return body?.data ?? [];
}

export async function getChapterContent(authorSession, storyId, chapterId) {
  const response = await authorSession.authFetch(
    `/api/v1/author/stories/${storyId}/chapters/${chapterId}`,
  );
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw new Error(`Lấy nội dung chương thất bại (${response.status}): ${describeApiError(body)}`);
  }
  return body?.data?.content ?? '';
}

export async function createChapter(authorSession, storyId, chapter) {
  return mutateAndParse(
    authorSession,
    `/api/v1/author/stories/${storyId}/chapters`,
    { body: { title: chapter.title, content: chapter.content } },
    `Tạo chương "${chapter.title}"`,
  );
}

export async function submitChapterReview(authorSession, storyId, chapterId, expectedVersion) {
  return mutateAndParse(
    authorSession,
    `/api/v1/author/stories/${storyId}/chapters/${chapterId}/submit-review`,
    { body: { expectedVersion } },
    'submit-review',
  );
}

export async function approveChapter(adminSession, chapterId, expectedVersion) {
  return mutateAndParse(
    adminSession,
    `/api/v1/admin/chapter-reviews/${chapterId}`,
    { body: { expectedVersion, decision: 'APPROVED' } },
    'admin approve chương',
  );
}

export async function publishChapter(authorSession, storyId, chapterId) {
  return mutateAndParse(
    authorSession,
    `/api/v1/author/stories/${storyId}/chapters/${chapterId}/publish`,
    {},
    'publish chương',
  );
}
