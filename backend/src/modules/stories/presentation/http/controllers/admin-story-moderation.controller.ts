import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { StorySubmissionNotFoundException } from '../../../domain';
import { STORY_MODERATION_READER_PORT, type StoryModerationReaderPort } from '../../../application';
import { ListAdminStorySubmissionsRequest } from '../requests';
import { toAdminStorySubmissionDetailResponse, toAdminStorySubmissionListResponse, type AdminStorySubmissionListResponse } from '../responses';
@Controller('admin/story-submissions')
@RequirePermissions(PermissionCode.STORY_REVIEW)
export class AdminStoryModerationController {
  constructor(@Inject(STORY_MODERATION_READER_PORT) private readonly reader: StoryModerationReaderPort) {}
  @Get()
  async list(@Query() request: ListAdminStorySubmissionsRequest): Promise<AdminStorySubmissionListResponse> { const result=await this.reader.listStorySubmissions({ status: request.status, author: request.author, story: request.story, reviewer: request.reviewer, submittedFrom: request.submittedFrom ? new Date(request.submittedFrom) : undefined, submittedTo: request.submittedTo ? new Date(request.submittedTo) : undefined, page: request.page, pageSize: request.pageSize, sort: request.sort }); return toAdminStorySubmissionListResponse(result, request.page, request.pageSize); }
  @Get(':submissionId')
  async detail(@Param('submissionId', new ParseUUIDPipe({ version: '4' })) submissionId: string) { const result=await this.reader.getStorySubmission(submissionId); if(!result) throw new StorySubmissionNotFoundException(submissionId); return toAdminStorySubmissionDetailResponse(result); }
}
