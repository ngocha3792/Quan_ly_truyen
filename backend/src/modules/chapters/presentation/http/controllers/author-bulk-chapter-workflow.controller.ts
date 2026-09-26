import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import {
  BulkChapterWorkflowCommand,
  BulkChapterWorkflowCommandHandler,
} from '../../../application/commands/bulk-chapter-workflow';

/**
 * Lô thao tác của tác giả không có `chapterId`, nên không nằm được dưới
 * `AuthorChapterWorkflowController`. Tách ra một controller riêng cùng tiền tố
 * đường dẫn thay vì nhét vào module khác chỉ để đi cùng controller sẵn có.
 */
@Controller('author/stories/:storyId/chapters')
@RequirePermissions(PermissionCode.STORY_READ)
export class AuthorBulkChapterWorkflowController {
  constructor(private readonly commands: BulkChapterWorkflowCommandHandler) {}

  /** Gửi duyệt mọi bản nháp của truyện trong một lần bấm. */
  @Post('submit-all')
  @HttpCode(200)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  async submitAll(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @ClientIp() ipAddress?: string,
    @UserAgent() userAgent?: string,
    @RequestId() requestId?: string,
  ) {
    return this.commands.execute(
      new BulkChapterWorkflowCommand(
        userId,
        'submit',
        storyId,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }
}
