import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  ClientIp,
  CurrentUserId,
  Public,
  RequirePermissions,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import { AuthenticationRequiredException, InvalidInputException } from '@/common/exceptions';
import { ReactionType, ReportReason } from '@/generated/prisma/client';
import { CommentsService } from '../../application';

class CreateReplyRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

class SetReactionRequest {
  @IsEnum(ReactionType)
  type!: keyof typeof ReactionType;
}

class CreateCommentReportRequest {
  @IsEnum(ReportReason)
  reason!: keyof typeof ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post(':parentCommentId/replies')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.COMMENT_CREATE)
  createReply(
    @CurrentUserId() userId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @Param('parentCommentId', new ParseUUIDPipe({ version: '4' })) parentCommentId: string,
    @Body() request: CreateReplyRequest,
  ) {
    return this.comments.createReply({
      userId: this.user(userId),
      parentCommentId,
      body: request.body,
      ipAddress,
    });
  }

  @Get(':rootCommentId/replies')
  @Public()
  listReplies(
    @Param('rootCommentId', new ParseUUIDPipe({ version: '4' })) rootCommentId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.comments.listReplies(rootCommentId, this.positiveInt(page, 1), this.positiveInt(pageSize, 20));
  }

  @Post(':commentId/reactions')
  @RequirePermissions(PermissionCode.COMMENT_CREATE)
  setReaction(
    @CurrentUserId() userId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: SetReactionRequest,
  ) {
    return this.comments.setReaction({
      userId: this.user(userId),
      commentId,
      type: request.type,
      ipAddress,
    });
  }

  @Delete(':commentId/reactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.COMMENT_CREATE)
  async clearReaction(
    @CurrentUserId() userId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
  ): Promise<void> {
    await this.comments.clearReaction({ userId: this.user(userId), commentId, ipAddress });
  }

  @Get('reactions/me')
  @RequirePermissions(PermissionCode.COMMENT_CREATE)
  viewerReactions(
    @CurrentUserId() userId: string | undefined,
    @Query('commentIds') rawCommentIds = '',
  ) {
    const ids = rawCommentIds.split(',').map((value) => value.trim()).filter(Boolean);
    if (ids.length > 50 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
      throw new InvalidInputException({ code: 'COMMENT_REACTION_BATCH_INVALID', message: 'Danh sách commentIds không hợp lệ hoặc vượt quá 50 phần tử' });
    }
    return this.comments.viewerReactions(this.user(userId), ids);
  }

  @Post(':commentId/report')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.REPORT_CREATE)
  createReport(
    @CurrentUserId() userId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: CreateCommentReportRequest,
  ) {
    return this.comments.createReport({
      userId: this.user(userId),
      commentId,
      reason: request.reason,
      description: request.description,
      ipAddress,
    });
  }

  private user(value: string | undefined): string {
    if (!value) throw new AuthenticationRequiredException();
    return value;
  }

  private positiveInt(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
