import { Body, Controller, Delete, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  TakeDownChapterCommand,
  TakeDownChapterCommandHandler,
  TakeDownStoryCommand,
  TakeDownStoryCommandHandler,
} from '../../../application';

class TakeDownContentRequest {
  @IsString() @MinLength(10) @MaxLength(2000) reason!: string;

  /** Bắt buộc bật khi nội dung đã có lượt mua, nếu không sẽ bị từ chối 409. */
  @IsOptional() @IsBoolean() acknowledgePurchases?: boolean;
}

/**
 * Cửa sau cho admin gỡ nội dung lỡ xuất bản. Không có màn hình nào gọi tới —
 * chỉ dùng bằng tay khi xuất bản nhầm — nhưng vẫn đi qua permission guard và
 * vẫn ghi audit log như mọi hành động quản trị khác.
 */
@Controller('admin/content-takedown')
export class AdminContentTakedownController {
  constructor(
    private readonly takeDownChapter: TakeDownChapterCommandHandler,
    private readonly takeDownStory: TakeDownStoryCommandHandler,
  ) {}

  @Delete('chapters/:chapterId')
  @Idempotent({ required: false, ttlSeconds: 86_400 })
  @RequirePermissions(
    PermissionCode.CHAPTER_MANAGE_ANY,
    PermissionCode.MODERATION_EXECUTE,
  )
  chapter(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Body() request: TakeDownContentRequest,
  ) {
    return this.takeDownChapter.execute(
      new TakeDownChapterCommand(
        this.actor(actorId),
        chapterId,
        request.reason,
        request.acknowledgePurchases ?? false,
        { ipAddress, userAgent, requestId },
      ),
    );
  }

  @Delete('stories/:storyId')
  @Idempotent({ required: false, ttlSeconds: 86_400 })
  @RequirePermissions(
    PermissionCode.STORY_DELETE_ANY,
    PermissionCode.MODERATION_EXECUTE,
  )
  story(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: TakeDownContentRequest,
  ) {
    return this.takeDownStory.execute(
      new TakeDownStoryCommand(
        this.actor(actorId),
        storyId,
        request.reason,
        request.acknowledgePurchases ?? false,
        { ipAddress, userAgent, requestId },
      ),
    );
  }

  private actor(value: string | undefined): string {
    if (!value) throw new AuthenticationRequiredException();
    return value;
  }
}
