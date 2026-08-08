import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
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
  GetAuthorApplicationConfigQuery,
  GetAuthorApplicationConfigQueryHandler,
  GetMyAuthorApplicationQuery,
  GetMyAuthorApplicationQueryHandler,
  SaveAuthorApplicationDraftCommand,
  SaveAuthorApplicationDraftCommandHandler,
  SubmitAuthorApplicationCommand,
  SubmitAuthorApplicationCommandHandler,
} from '../../../application';

import {
  SaveAuthorApplicationDraftRequest,
  SubmitAuthorApplicationRequest,
} from '../requests';

import {
  type AuthorApplicationResponse,
  toAuthorApplicationResponse,
} from '../responses';

@Controller('author-applications')
export class AuthorApplicationsController {
  constructor(
    private readonly getConfig: GetAuthorApplicationConfigQueryHandler,

    private readonly getMine: GetMyAuthorApplicationQueryHandler,

    private readonly saveDraft: SaveAuthorApplicationDraftCommandHandler,

    private readonly submit: SubmitAuthorApplicationCommandHandler,
  ) {}

  @Get('config')
  @RequirePermissions(PermissionCode.AUTHOR_APPLICATION_CREATE)
  getConfiguration() {
    return this.getConfig.execute(new GetAuthorApplicationConfigQuery());
  }

  @Get('me')
  @RequirePermissions(PermissionCode.AUTHOR_APPLICATION_READ_OWN)
  async getMyApplication(
    @CurrentUserId()
    userId: string | undefined,
  ): Promise<AuthorApplicationResponse | null> {
    const result = await this.getMine.execute(
      new GetMyAuthorApplicationQuery(userId),
    );

    return result ? toAuthorApplicationResponse(result) : null;
  }

  @Put('me/draft')
  @RequirePermissions(PermissionCode.AUTHOR_APPLICATION_CREATE)
  async saveMyDraft(
    @CurrentUserId()
    userId: string | undefined,

    @Body()
    request: SaveAuthorApplicationDraftRequest,
  ): Promise<AuthorApplicationResponse> {
    const result = await this.saveDraft.execute(
      new SaveAuthorApplicationDraftCommand(
        userId,

        request.penName,

        request.fullName,

        request.email,

        request.phone,

        request.portfolioUrl,

        request.primaryGenre,

        request.experience,

        request.introduction,

        request.firstWorkSynopsis,

        request.acceptedTerms,
      ),
    );

    return toAuthorApplicationResponse(result);
  }

  @Post('me/submit')
  @HttpCode(HttpStatus.OK)
  @Idempotent({
    required: true,

    ttlSeconds: 86_400,
  })
  @RequirePermissions(PermissionCode.AUTHOR_APPLICATION_CREATE)
  async submitMyApplication(
    @CurrentUserId()
    userId: string | undefined,

    @Body()
    request: SubmitAuthorApplicationRequest,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @RequestId()
    requestId: string | undefined,
  ): Promise<AuthorApplicationResponse> {
    const result = await this.submit.execute(
      new SubmitAuthorApplicationCommand(
        userId,

        request.applicationId,

        request.sampleMediaId,

        ipAddress,

        userAgent,

        requestId,
      ),
    );

    return toAuthorApplicationResponse(result);
  }
}
