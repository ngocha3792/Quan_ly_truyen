import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationRequiredException } from '@/common/exceptions';
import {
  CHAPTER_WORKFLOW_PORT,
  type ChapterWorkflowPort,
} from '../../ports/chapter-workflow.port';

@Injectable()
export class ChapterWorkflowQueryHandler {
  constructor(
    @Inject(CHAPTER_WORKFLOW_PORT)
    private readonly persistence: ChapterWorkflowPort,
  ) {}

  get(userId: string | undefined, chapterId: string, storyId?: string) {
    return this.persistence.get(requireUser(userId), chapterId, storyId);
  }

  list(userId: string | undefined, page: number, pageSize: number) {
    return this.persistence.listReviews(requireUser(userId), page, pageSize);
  }
}

function requireUser(userId?: string): string {
  if (!userId)
    throw new AuthenticationRequiredException({ message: 'Bạn cần đăng nhập' });
  return userId;
}
