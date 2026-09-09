import { BrowserContext, Route } from '@playwright/test';

export const STORY_ID = '11111111-1111-4111-8111-111111111111';
export const CHAPTER_ID = '22222222-2222-4222-8222-222222222222';
export const EDITOR_URL = `/author-studio/truyen/${STORY_ID}/chuong/${CHAPTER_ID}`;
const USER_ID = '33333333-3333-4333-8333-333333333333';
const chapterPath = `/api/v1/author/stories/${STORY_ID}/chapters/${CHAPTER_ID}`;
const timestamp = '2026-09-09T01:00:00.000Z';

interface DraftRequest {
  title: string;
  content: string;
  expectedVersion: number;
}
interface CapturedSave {
  endpoint: string;
  input: DraftRequest;
}

/** All API traffic is fulfilled locally; these tests never mutate a real backend. */
export async function mockAuthorEditorApi(
  context: BrowserContext,
  options: { reviewer?: boolean; storyStatus?: string; chapterStatus?: string } = {},
) {
  let chapter = {
    id: CHAPTER_ID,
    storyId: STORY_ID,
    number: 1,
    title: 'Chương đang viết',
    slug: 'chuong-dang-viet',
    status: options.chapterStatus ?? 'DRAFT',
    wordCount: 4,
    version: 2,
    content: 'Nội dung ban đầu.',
    contentFormat: 'MARKDOWN',
    createdById: USER_ID,
    updatedById: USER_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    scheduledAt: null,
    publishedAt: null,
  };
  const snapshots = new Map([
    [1, { ...chapter, version: 1, title: 'Bản đầu tiên', content: 'Nội dung phiên bản một.' }],
    [2, { ...chapter }],
  ]);
  const saves: CapturedSave[] = [];
  const restores: {
    version: number;
    expectedVersion: number;
    idempotencyKey: string | undefined;
  }[] = [];
  const transitions: { action: string; expectedVersion: number; idempotencyKey: string }[] = [];
  const reviews: {
    expectedVersion: number;
    decision: string;
    comment?: string;
    idempotencyKey: string;
  }[] = [];
  let holdNext = false;
  let releasePending: (() => void) | undefined;
  await context.addInitScript(() =>
    localStorage.setItem('truyenhub.auth.has-refresh-session', 'true'),
  );
  await context.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === '/api/v1/auth/client-config') return ok(clientConfig);
    if (path === '/api/v1/auth/refresh')
      return ok({
        sessionId: 'editor-test',
        accessToken: 'controlled-editor-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
    if (path === '/api/v1/auth/me')
      return ok({
        id: USER_ID,
        email: 'editor@test.invalid',
        username: 'editor',
        displayName: 'Tác giả kiểm thử',
        emailVerified: true,
        roles: ['author'],
        permissions: [
          'story.create',
          'chapter.update.own',
          'chapter.create',
          ...(options.reviewer ? ['chapter.manage.any'] : []),
        ],
        sessionId: 'editor-test',
        bio: null,
        status: 'ACTIVE',
        emailVerifiedAt: timestamp,
        lastLoginAt: timestamp,
        avatar: null,
        authorProfile: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    if (path === `/api/v1/author/stories/${STORY_ID}`)
      return ok({
        id: STORY_ID,
        authorId: USER_ID,
        title: 'Truyện kiểm thử Author Studio',
        slug: 'truyen-kiem-thu',
        synopsis: '',
        languageCode: 'vi',
        status: options.storyStatus ?? 'PUBLISHED',
        visibility: 'PUBLIC',
        contentRating: 'GENERAL',
        coverMediaId: null,
        publishedAt: timestamp,
        categories: [],
        tags: [],
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    if (path === chapterPath && method === 'GET') return ok(chapter);
    if (path === `${chapterPath}/workflow`)
      return ok({
        status: chapter.status,
        version: chapter.version,
        canEdit: chapter.status === 'DRAFT',
        canSubmit: chapter.status === 'DRAFT',
        canPublish: false,
        canReopen: chapter.status === 'APPROVED',
        reviews: [],
      });
    if (path === `${chapterPath}/submit-review` || path === `${chapterPath}/reopen`) {
      const idempotencyKey = route.request().headers()['x-idempotency-key'];
      if (!idempotencyKey) return missingIdempotencyKey(route);
      const input = route.request().postDataJSON() as { expectedVersion: number };
      if (input.expectedVersion !== chapter.version) return conflict(route);
      const action = path.endsWith('/reopen') ? 'reopen' : 'submit-review';
      transitions.push({ action, ...input, idempotencyKey });
      chapter = {
        ...chapter,
        status: action === 'reopen' ? 'DRAFT' : 'IN_REVIEW',
        version: chapter.version + 1,
      };
      return ok(chapter);
    }
    if (path.startsWith('/api/v1/admin/chapter-reviews')) {
      const detail = { chapter, storyTitle: 'Truyện kiểm thử Author Studio', reviews: [] };
      if (path === '/api/v1/admin/chapter-reviews')
        return ok({
          items: chapter.status === 'IN_REVIEW' ? [detail] : [],
          total: chapter.status === 'IN_REVIEW' ? 1 : 0,
          page: 1,
          pageSize: 20,
        });
      if (method === 'GET') return ok(detail);
      const idempotencyKey = route.request().headers()['x-idempotency-key'];
      if (!idempotencyKey) return missingIdempotencyKey(route);
      const input = route.request().postDataJSON() as {
        expectedVersion: number;
        decision: string;
        comment?: string;
      };
      if (input.expectedVersion !== chapter.version) return conflict(route);
      reviews.push({ ...input, idempotencyKey });
      chapter = {
        ...chapter,
        status: input.decision === 'APPROVED' ? 'APPROVED' : 'DRAFT',
        version: chapter.version + 1,
      };
      return ok(chapter);
    }
    if (path.includes('/edit-sessions')) {
      if (method === 'GET') return ok([]);
      if (method === 'DELETE') return route.fulfill({ status: 204 });
      return ok({
        id: route.request().postDataJSON()?.tabId ?? 'edit-session',
        userId: USER_ID,
        displayName: 'Tác giả kiểm thử',
        tabId: route.request().postDataJSON()?.tabId,
        sessionToken: 'controlled-session-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
        lastHeartbeatAt: timestamp,
      });
    }
    if (path === `${chapterPath}/autosave` || (path === chapterPath && method === 'PATCH')) {
      const input = route.request().postDataJSON() as DraftRequest;
      saves.push({ endpoint: path, input });
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((resolve) => {
          releasePending = resolve;
        });
      }
      if (input.expectedVersion !== chapter.version) return conflict(route);
      chapter = {
        ...chapter,
        ...input,
        version: chapter.version + 1,
        wordCount: input.content.trim().split(/\s+/u).length,
      };
      snapshots.set(chapter.version, { ...chapter });
      return ok(chapter);
    }
    const versionMatch = path.match(/\/versions\/(\d+)(\/restore)?$/u);
    if (versionMatch) {
      const version = Number(versionMatch[1]);
      const snapshot = snapshots.get(version)!;
      if (!versionMatch[2]) return ok(versionDto(snapshot));
      const input = route.request().postDataJSON() as { expectedVersion: number };
      restores.push({
        version,
        expectedVersion: input.expectedVersion,
        idempotencyKey: route.request().headers()['x-idempotency-key'],
      });
      if (input.expectedVersion !== chapter.version) return conflict(route);
      chapter = {
        ...chapter,
        title: snapshot.title,
        content: snapshot.content,
        version: chapter.version + 1,
      };
      snapshots.set(chapter.version, { ...chapter });
      return ok(chapter);
    }
    if (path === `${chapterPath}/versions`)
      return ok({
        items: [...snapshots.values()].reverse().map(versionDto),
        total: snapshots.size,
        page: 1,
        pageSize: 10,
      });
    if (path.endsWith('/monetization') || path.endsWith('/ai-profile')) return ok(null);
    if (path.endsWith('/price-bands')) return ok([]);
    if (path.includes('/notifications')) return ok({ items: [], total: 0, unreadCount: 0 });
    return ok([]);
  });
  function versionDto(snapshot: typeof chapter) {
    return {
      ...snapshot,
      id: `version-${snapshot.version}`,
      chapterId: CHAPTER_ID,
      createdByDisplayName: 'Tác giả kiểm thử',
      versionType: 'MANUAL_SAVE',
      changeSummary: null,
      isRetained: true,
      expiresAt: null,
    };
  }
  function conflict(route: Route) {
    return route.fulfill({
      status: 409,
      json: {
        success: false,
        error: {
          code: 'CHAPTER_VERSION_CONFLICT',
          message: 'Chương đã thay đổi, vui lòng kiểm tra phiên bản.',
          details: { currentVersion: chapter.version },
          retryable: false,
        },
      },
    });
  }
  function missingIdempotencyKey(route: Route) {
    return route.fulfill({
      status: 400,
      json: {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Thiếu x-idempotency-key.' },
      },
    });
  }
  return {
    saves,
    restores,
    transitions,
    reviews,
    chapter: () => chapter,
    setChapterStatus: (status: string) => {
      chapter = { ...chapter, status, version: chapter.version + 1 };
    },
    holdNextSave: () => {
      holdNext = true;
    },
    releaseSave: () => releasePending?.(),
  };
}

const clientConfig = {
  features: {
    monetizationEnabled: false,
    paymentProviderEnabled: false,
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
};
