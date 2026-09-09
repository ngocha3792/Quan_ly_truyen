import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationRequiredException } from '@/common/exceptions';
import {
  CHAPTER_EDIT_SESSION_PORT,
  type ChapterEditSessionPort,
} from '../../ports/chapter-workflow.port';

@Injectable()
export class ChapterEditSessionCommandHandler {
  constructor(
    @Inject(CHAPTER_EDIT_SESSION_PORT)
    private readonly sessions: ChapterEditSessionPort,
  ) {}

  list(userId: string | undefined, storyId: string, chapterId: string) {
    return this.sessions.list(requireUser(userId), storyId, chapterId);
  }
  save(
    userId: string | undefined,
    storyId: string,
    chapterId: string,
    tabId: string,
    token?: string,
  ) {
    return this.sessions.save(
      requireUser(userId),
      storyId,
      chapterId,
      tabId,
      token,
    );
  }
  remove(
    userId: string | undefined,
    storyId: string,
    chapterId: string,
    token: string,
  ) {
    return this.sessions.remove(requireUser(userId), storyId, chapterId, token);
  }
}

function requireUser(userId?: string): string {
  if (!userId)
    throw new AuthenticationRequiredException({ message: 'Bạn cần đăng nhập' });
  return userId;
}
