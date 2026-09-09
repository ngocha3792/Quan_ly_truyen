import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import {
  AI_AUTHOR_PERSISTENCE_PORT,
  AiAuthorPersistencePort,
} from './ai-author.persistence.port';
import {
  AuthorJobError,
  type AuthorJob,
  type AuthorSource,
  type CreateAuthorJob,
} from './ai-author.types';
import {
  assertSourceUnchanged,
  buildAuthorPrompt,
  snapshotAuthorSource,
} from './ai-author-output';
import { AiAuthorConnectionResolver } from './ai-author-connection.resolver';

export function authorJobView(job: AuthorJob) {
  const { leaseToken: _token, leaseExpiresAt: _lease, ...view } = job;
  void _token;
  void _lease;
  return {
    ...view,
    sourceStale: false,
    totalCost: job.totalCost?.toString() ?? null,
    costStatus: job.totalCost === null ? 'UNAVAILABLE' : 'REPORTED',
  };
}
export async function authorToolOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof AuthorJobError)) throw error;
    if (
      ['ACCESS_DENIED', 'NOT_FOUND', 'CHAPTER_NOT_FOUND'].includes(error.code)
    )
      throw new ResourceNotFoundException({ resource: 'Công cụ tác giả' });
    const messages: Record<string, string> = {
      SOURCE_TOO_LARGE:
        'Truyện vượt giới hạn 20 chương hoặc 32.000 ký tự. Hãy dùng tóm tắt từng chương; nội dung không bị cắt ngầm.',
      SOURCE_EMPTY: 'Chưa có nội dung chương để phân tích.',
      SOURCE_CHANGED: 'Nội dung đã thay đổi. Hãy tạo tác vụ mới.',
      CONNECTION_UNAVAILABLE:
        'Kết nối AI đã chọn không còn khả dụng hoặc không thuộc quyền sử dụng của bạn.',
      TOO_MANY_ACTIVE_JOBS: 'Bạn đã có 3 tác vụ AI đang chờ hoặc đang chạy.',
      RETRY_NOT_ALLOWED: 'Chỉ được thử lại tác vụ thất bại tối đa 2 lần.',
      CHAPTER_REQUIRED: 'Cần chọn chương cho công cụ này.',
      JOB_CHANGED: 'Trạng thái tác vụ đã thay đổi.',
    };
    throw new BusinessRuleViolationException({
      code: `AI_AUTHOR_${error.code}`,
      message: messages[error.code] ?? 'Không thể thực hiện thao tác AI này.',
      rule: 'ai.author-tools',
    });
  }
}
@Injectable()
export class AiAuthorJobManager {
  constructor(
    @Inject(AI_AUTHOR_PERSISTENCE_PORT)
    private readonly persistence: AiAuthorPersistencePort,
    private readonly connections: AiAuthorConnectionResolver,
  ) {}
  create(input: CreateAuthorJob) {
    return authorToolOperation(async () => {
      const needsChapter = ['CHAPTER_SUMMARY', 'CONSISTENCY_CHECK'].includes(
        input.jobType,
      );
      if (needsChapter !== !!input.chapterId)
        throw new AuthorJobError('CHAPTER_REQUIRED');
      await this.persistence.assertAccess(input.userId, input.storyId);
      await this.connections.resolve(input.userId, input.connectionId);
      const source = await this.persistence.source(input);
      if (
        input.expectedVersion !== undefined &&
        source.chapters.find((c) => c.id === input.chapterId)?.version !==
          input.expectedVersion
      )
        throw new AuthorJobError('SOURCE_CHANGED');
      buildAuthorPrompt(input.jobType, source, input.chapterId ?? null);
      return authorJobView(
        await this.persistence.create(input, snapshotAuthorSource(source)),
      );
    });
  }
  list(userId: string, storyId: string) {
    return authorToolOperation(async () => {
      const sources = new Map<string, Promise<AuthorSource>>();
      return Promise.all(
        (await this.persistence.list(userId, storyId)).map((job) =>
          this.viewWithFreshness(job, sources),
        ),
      );
    });
  }
  get(userId: string, storyId: string, id: string) {
    return authorToolOperation(async () => {
      await this.persistence.assertAccess(userId, storyId);
      const job = await this.persistence.find(id);
      if (!job || job.storyId !== storyId || job.userId !== userId)
        throw new AuthorJobError('NOT_FOUND');
      return this.viewWithFreshness(job);
    });
  }
  transition(
    userId: string,
    storyId: string,
    id: string,
    action: 'cancel' | 'retry',
  ) {
    return authorToolOperation(async () =>
      authorJobView(
        await this.persistence.transition(userId, storyId, id, action),
      ),
    );
  }
  characters(userId: string, storyId: string) {
    return authorToolOperation(() =>
      this.persistence.characters(userId, storyId),
    );
  }
  verifyCharacter(userId: string, storyId: string, id: string, value: boolean) {
    return authorToolOperation(() =>
      this.persistence.verifyCharacter(userId, storyId, id, value),
    );
  }
  issues(userId: string, storyId: string, chapterId?: string) {
    return authorToolOperation(() =>
      this.persistence.issues(userId, storyId, chapterId),
    );
  }
  updateIssue(
    userId: string,
    storyId: string,
    id: string,
    patch: { isDismissed?: boolean; isResolved?: boolean },
  ) {
    return authorToolOperation(() =>
      this.persistence.updateIssue(userId, storyId, id, patch),
    );
  }
  private async viewWithFreshness(
    job: AuthorJob,
    sources = new Map<string, Promise<AuthorSource>>(),
  ) {
    let sourceStale = false;
    try {
      const key = `${job.jobType}:${job.chapterId ?? ''}`;
      const currentSource =
        sources.get(key) ??
        this.persistence.source({
          ...job,
          chapterId: job.chapterId ?? undefined,
        });
      sources.set(key, currentSource);
      const source = await currentSource;
      assertSourceUnchanged(job.sourceSnapshot, source);
    } catch (error) {
      if (!(error instanceof AuthorJobError)) throw error;
      if (error.code === 'ACCESS_DENIED') throw error;
      sourceStale = true;
    }
    return { ...authorJobView(job), sourceStale };
  }
}
