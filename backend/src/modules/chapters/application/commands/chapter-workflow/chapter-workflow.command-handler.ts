import { Inject, Injectable } from '@nestjs/common';
import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';
import {
  CHAPTER_WORKFLOW_PORT,
  type ChapterWorkflowMutation,
  type ChapterWorkflowPort,
} from '../../ports/chapter-workflow.port';

@Injectable()
export class ChapterWorkflowCommandHandler {
  constructor(
    @Inject(CHAPTER_WORKFLOW_PORT)
    private readonly persistence: ChapterWorkflowPort,
  ) {}

  execute(
    command: Omit<ChapterWorkflowMutation, 'userId'> & { userId?: string },
  ) {
    if (!command.userId || !isUuidV4(command.userId)) {
      throw new AuthenticationRequiredException({
        message: 'Bạn cần đăng nhập để quản lý chương',
      });
    }
    if (
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion < 1
    ) {
      throw new InvalidInputException({
        message: 'Phiên bản chương không hợp lệ',
      });
    }
    if (
      ['REJECTED', 'REQUEST_CHANGES'].includes(command.action) &&
      !command.comment?.trim()
    ) {
      throw new InvalidInputException({
        message: 'Vui lòng ghi rõ lý do cần chỉnh sửa chương',
      });
    }
    return this.persistence.transition({
      ...command,
      userId: command.userId,
      comment: command.comment?.trim(),
    });
  }
}
