import {
  Body,
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
import { PermissionCode } from '@/common/enums';
import {
  UpdateAuthorChapterCommand,
  UpdateAuthorChapterCommandHandler,
} from '../../../application';
import { UpdateAuthorChapterRequest } from '../requests';
import { toChapterResponse } from '../responses';

@Controller('author/stories/:storyId/chapters')
export class AuthorChapterAutosaveController {
  constructor(
    private readonly updateChapter: UpdateAuthorChapterCommandHandler,
  ) {}

  @Post(':chapterId/autosave')
  @HttpCode(200)
  @RequirePermissions(PermissionCode.STORY_READ)
  async autosave(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Body() request: UpdateAuthorChapterRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ) {
    return toChapterResponse(
      await this.updateChapter.execute(
        new UpdateAuthorChapterCommand(
          userId,
          storyId,
          chapterId,
          request.title,
          request.content,
          ipAddress,
          userAgent,
          requestId,
          request.expectedVersion,
          'AUTOSAVE',
        ),
      ),
    );
  }
}
