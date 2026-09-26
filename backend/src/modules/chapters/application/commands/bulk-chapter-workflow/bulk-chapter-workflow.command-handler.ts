import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import type { BulkChapterActionResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_WORKFLOW_PORT,
  type ChapterWorkflowPort,
} from '../../ports/chapter-workflow.port';
import { BulkChapterWorkflowCommand } from './bulk-chapter-workflow.command';

@Injectable()
export class BulkChapterWorkflowCommandHandler {
  constructor(
    @Inject(CHAPTER_WORKFLOW_PORT)
    private readonly workflow: ChapterWorkflowPort,
  ) {}

  async execute(
    command: BulkChapterWorkflowCommand,
  ): Promise<BulkChapterActionResultDto> {
    const userId = requireUserId(command.userId);
    const result = await this.workflow.transitionMany({
      userId,
      action: command.action,
      ...(command.storyId ? { storyId: command.storyId } : {}),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    return {
      changed: result.succeeded.map((chapter) =>
        ChapterResultMapper.toDto(chapter),
      ),
      skipped: result.skipped,
      remaining: result.remaining,
    };
  }
}

function requireUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'CHAPTER_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập để dùng thao tác hàng loạt',
    });
  }

  return userId;
}
