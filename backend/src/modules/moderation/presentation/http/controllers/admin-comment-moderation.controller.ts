import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  IsOptional,
  IsString,
  IsUUID,
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
  BanUserCommand,
  BanUserCommandHandler,
  ModerateCommentCommand,
  ModerateCommentCommandHandler,
  WarnUserCommand,
  WarnUserCommandHandler,
  type CommentModerationOperation,
} from '../../../application';

class ModerateCommentRequest {
  @IsString() @MinLength(10) @MaxLength(2000) reason!: string;
  @IsOptional() @IsUUID('4') reportId?: string;
}

class WarnUserRequest extends ModerateCommentRequest {
  @IsString() @MinLength(10) @MaxLength(1000) message!: string;
}

@Controller('admin/comments')
export class AdminCommentModerationController {
  constructor(
    private readonly moderateComment: ModerateCommentCommandHandler,
    private readonly warnUser: WarnUserCommandHandler,
    private readonly banUser: BanUserCommandHandler,
  ) {}

  @Post(':commentId/moderation/hold')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(
    PermissionCode.COMMENT_MODERATE,
    PermissionCode.MODERATION_EXECUTE,
  )
  hold(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: ModerateCommentRequest,
  ) {
    return this.moderate(
      'hold',
      actorId,
      ipAddress,
      userAgent,
      requestId,
      commentId,
      request,
    );
  }

  @Post(':commentId/moderation/hide')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(
    PermissionCode.COMMENT_MODERATE,
    PermissionCode.MODERATION_EXECUTE,
  )
  hide(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: ModerateCommentRequest,
  ) {
    return this.moderate(
      'hide',
      actorId,
      ipAddress,
      userAgent,
      requestId,
      commentId,
      request,
    );
  }

  @Post(':commentId/moderation/restore')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(
    PermissionCode.COMMENT_MODERATE,
    PermissionCode.MODERATION_EXECUTE,
  )
  restore(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: ModerateCommentRequest,
  ) {
    return this.moderate(
      'restore',
      actorId,
      ipAddress,
      userAgent,
      requestId,
      commentId,
      request,
    );
  }

  @Post(':commentId/moderation/remove')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(
    PermissionCode.COMMENT_MODERATE,
    PermissionCode.MODERATION_EXECUTE,
  )
  remove(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: ModerateCommentRequest,
  ) {
    return this.moderate(
      'remove',
      actorId,
      ipAddress,
      userAgent,
      requestId,
      commentId,
      request,
    );
  }

  @Post(':commentId/moderation/warn-user')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.MODERATION_EXECUTE)
  warn(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: WarnUserRequest,
  ) {
    return this.warnUser.execute(new WarnUserCommand(
      this.actor(actorId), commentId, request.message, request.reason, request.reportId,
      { ipAddress, userAgent, requestId },
    ));
  }

  @Post(':commentId/moderation/ban-user')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(
    PermissionCode.MODERATION_EXECUTE,
    PermissionCode.USER_MANAGE,
  )
  ban(
    @CurrentUserId() actorId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: ModerateCommentRequest,
  ) {
    return this.banUser.execute(new BanUserCommand(
      this.actor(actorId), commentId, request.reason, request.reportId,
      { ipAddress, userAgent, requestId },
    ));
  }

  private moderate(
    operation: CommentModerationOperation,
    actorId: string | undefined,
    ipAddress: string | undefined,
    userAgent: string | undefined,
    requestId: string | undefined,
    commentId: string,
    request: ModerateCommentRequest,
  ) {
    return this.moderateComment.execute(new ModerateCommentCommand(
      this.actor(actorId), commentId, operation, request.reason, request.reportId,
      { ipAddress, userAgent, requestId },
    ));
  }

  private actor(value: string | undefined): string {
    if (!value) throw new AuthenticationRequiredException();
    return value;
  }
}
