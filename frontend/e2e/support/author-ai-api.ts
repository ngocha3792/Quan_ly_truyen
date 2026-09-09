import { BrowserContext } from '@playwright/test';
import { CHAPTER_ID, mockAuthorEditorApi, STORY_ID } from './author-studio-editor-api';

export const CONNECTION_ID = '44444444-4444-4444-8444-444444444444';
const JOB_ID = '55555555-5555-4555-8555-555555555555';
export async function mockAuthorAiApi(context: BrowserContext) {
  const editor = await mockAuthorEditorApi(context);
  const requests: Record<string, unknown>[] = [];
  const reviews: Record<string, unknown>[] = [];
  const issueUpdates: Record<string, unknown>[] = [];
  let failedReview = false;
  let job: Record<string, unknown> | null = null;
  let knowledge = false;
  let verified = false;
  let issueState = { isResolved: false, isDismissed: false };
  let translation = {
    id: '66666666-6666-4666-8666-666666666666',
    targetLanguageCode: 'en',
    status: 'COMPLETED',
    translatedTitle: 'Translated chapter',
    translatedContent: 'The first translation draft.',
    reviewStatus: 'PENDING',
    revisionNotes: null as string | null,
    sourceContentHash: 'source-hash',
    generation: 1,
    sourceVersion: 2,
    errorCode: null,
    errorMessage: null,
    createdAt: '2026-09-09T01:00:00.000Z',
    updatedAt: '2026-09-09T01:00:00.000Z',
  };
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === '/api/v1/ai/connections')
      return ok([
        { id: CONNECTION_ID, name: 'Kết nối kiểm thử', enabled: true, defaultModel: 'model-test' },
      ]);
    if (path === '/api/v1/ai/policy') return ok({ fallbackPolicy: 'NONE' });
    if (path.endsWith('/ai-jobs')) {
      if (request.method() === 'GET') return ok(job ? [job] : []);
      const input = request.postDataJSON() as Record<string, unknown>;
      requests.push(input);
      job = {
        id: JOB_ID,
        ...input,
        status: 'PENDING',
        storyId: STORY_ID,
        result: null,
        sourceSnapshot: { storyVersion: 1, chapters: [{ id: CHAPTER_ID, version: 2, number: 1 }] },
        model: 'model-test',
        inputTokens: null,
        outputTokens: null,
        totalCost: null,
        costStatus: 'UNAVAILABLE',
        failureReason: null,
      };
      return ok(job);
    }
    if (path.includes('/ai-jobs/')) {
      job = { ...job, status: path.endsWith('/cancel') ? 'CANCELLED' : 'PENDING' };
      return ok(job);
    }
    if (path.endsWith('/characters'))
      return ok(
        knowledge
          ? [
              {
                id: 'hero',
                name: 'Minh',
                aliases: ['Người lữ hành'],
                description: 'Nhân vật chính.',
                firstAppearance: CHAPTER_ID,
                isVerified: verified,
                appearances: [{ chapterId: CHAPTER_ID, role: 'main', mentions: 3 }],
                relationships: [],
              },
            ]
          : [],
      );
    if (path.endsWith('/characters/hero')) {
      verified = request.postDataJSON().isVerified as boolean;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/consistency-issues'))
      return ok(
        knowledge
          ? [
              {
                id: 'issue',
                chapterId: CHAPTER_ID,
                sourceVersion: 2,
                issueType: 'TIMELINE_ERROR',
                severity: 'HIGH',
                description: 'Nhân vật xuất hiện ở hai nơi cùng lúc.',
                suggestion: 'Kiểm tra thứ tự sự kiện.',
                relatedChapterIds: [],
                ...issueState,
              },
            ]
          : [],
      );
    if (path.endsWith('/consistency-issues/issue')) {
      const input = request.postDataJSON() as Partial<typeof issueState>;
      issueUpdates.push(input);
      issueState = { ...issueState, ...input };
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/translations/en/review')) {
      const input = request.postDataJSON() as Record<string, unknown>;
      reviews.push(input);
      if (failedReview)
        return route.fulfill({
          status: 409,
          json: {
            success: false,
            error: { code: 'CHAPTER_VERSION_CONFLICT', message: 'Chương đã thay đổi.' },
          },
        });
      translation = {
        ...translation,
        ...(input['decision'] === 'APPROVE'
          ? {
              translatedTitle: input['translatedTitle'] as string,
              translatedContent: input['translatedContent'] as string,
            }
          : {}),
        reviewStatus:
          input['decision'] === 'APPROVE'
            ? 'APPROVED'
            : input['decision'] === 'REJECT'
              ? 'REJECTED'
              : 'REVISION_REQUESTED',
        revisionNotes: (input['notes'] as string) ?? null,
      };
      const chapter =
        input['decision'] === 'APPROVE'
          ? editor.setChapterContent(
              input['translatedTitle'] as string,
              input['translatedContent'] as string,
            )
          : null;
      return ok({ translation, chapter });
    }
    if (path.endsWith('/translations/en')) {
      if (request.method() === 'POST')
        translation = {
          ...translation,
          generation: translation.generation + 1,
          reviewStatus: 'PENDING',
          sourceVersion: editor.chapter().version,
        };
      return ok(translation);
    }
    return route.fallback();
  });
  return {
    ...editor,
    requests,
    reviews,
    issueUpdates,
    finishJob: () => {
      job = {
        ...job,
        status: 'COMPLETED',
        result: { summary: 'Minh bắt đầu cuộc hành trình.' },
        inputTokens: 100,
        outputTokens: 20,
      };
    },
    enableKnowledge: () => {
      knowledge = true;
    },
    failReview: () => {
      failedReview = true;
    },
  };
}
