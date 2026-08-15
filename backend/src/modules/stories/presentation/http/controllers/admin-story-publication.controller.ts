import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
  ApproveStorySubmissionCommand,
  ApproveStorySubmissionCommandHandler,
  RejectStorySubmissionCommand,
  RejectStorySubmissionCommandHandler,
} from '../../../application';
import { RejectStorySubmissionRequest } from '../requests';
import {
  type StoryPublicationResponse,
  toStoryPublicationResponse,
} from '../responses';

@Controller('admin/story-submissions')
export class AdminStoryPublicationController {
  constructor(
    private readonly approveSubmission: ApproveStorySubmissionCommandHandler,
    private readonly rejectSubmission: RejectStorySubmissionCommandHandler,
  ) {}

  @Post(':submissionId/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.STORY_REVIEW, PermissionCode.STORY_PUBLISH)
  async approve(
    @Param('submissionId', new ParseUUIDPipe({ version: '4' }))
    submissionId: string,
    @CurrentUserId() reviewerId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<StoryPublicationResponse> {
    const result = await this.approveSubmission.execute(
      new ApproveStorySubmissionCommand(
        reviewerId,
        submissionId,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toStoryPublicationResponse(result);
  }

  @Post(':submissionId/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.STORY_REVIEW)
  async reject(
    @Param('submissionId', new ParseUUIDPipe({ version: '4' }))
    submissionId: string,
    @CurrentUserId() reviewerId: string | undefined,
    @Body() request: RejectStorySubmissionRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<StoryPublicationResponse> {
    const result = await this.rejectSubmission.execute(
      new RejectStorySubmissionCommand(
        reviewerId,
        submissionId,
        request.reviewerNote,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toStoryPublicationResponse(result);
  }
}
