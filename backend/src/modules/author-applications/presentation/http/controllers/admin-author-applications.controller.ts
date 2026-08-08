import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  ApproveAuthorApplicationCommand,
  ApproveAuthorApplicationCommandHandler,
  GetAuthorApplicationQuery,
  GetAuthorApplicationQueryHandler,
  ListAuthorApplicationsQuery,
  ListAuthorApplicationsQueryHandler,
  RejectAuthorApplicationCommand,
  RejectAuthorApplicationCommandHandler,
} from '../../../application';

import {
  ListAuthorApplicationsRequest,
  RejectAuthorApplicationRequest,
} from '../requests';

import {
  type AuthorApplicationListResponse,
  type AuthorApplicationResponse,
  toAuthorApplicationListResponse,
  toAuthorApplicationResponse,
} from '../responses';

@Controller('author-applications/admin')
@RequirePermissions(PermissionCode.AUTHOR_APPLICATION_REVIEW)
export class AdminAuthorApplicationsController {
  constructor(
    private readonly listApplications: ListAuthorApplicationsQueryHandler,

    private readonly getApplication: GetAuthorApplicationQueryHandler,

    private readonly approveApplication: ApproveAuthorApplicationCommandHandler,

    private readonly rejectApplication: RejectAuthorApplicationCommandHandler,
  ) {}

  @Get()
  async list(
    @Query()
    request: ListAuthorApplicationsRequest,
  ): Promise<AuthorApplicationListResponse> {
    const result = await this.listApplications.execute(
      new ListAuthorApplicationsQuery(
        request.status,

        request.keyword,

        request.offset,

        request.limit,
      ),
    );

    return toAuthorApplicationListResponse(result);
  }

  @Get(':applicationId')
  async findOne(
    @Param(
      'applicationId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    applicationId: string,
  ): Promise<AuthorApplicationResponse> {
    const result = await this.getApplication.execute(
      new GetAuthorApplicationQuery(applicationId),
    );

    return toAuthorApplicationResponse(result);
  }

  @Post(':applicationId/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent({
    required: true,

    ttlSeconds: 86_400,
  })
  async approve(
    @Param(
      'applicationId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    applicationId: string,

    @CurrentUserId()
    reviewerId: string | undefined,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @RequestId()
    requestId: string | undefined,
  ): Promise<AuthorApplicationResponse> {
    const result = await this.approveApplication.execute(
      new ApproveAuthorApplicationCommand(
        applicationId,

        reviewerId,

        ipAddress,

        userAgent,

        requestId,
      ),
    );

    return toAuthorApplicationResponse(result);
  }

  @Post(':applicationId/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent({
    required: true,

    ttlSeconds: 86_400,
  })
  async reject(
    @Param(
      'applicationId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    applicationId: string,

    @CurrentUserId()
    reviewerId: string | undefined,

    @Body()
    request: RejectAuthorApplicationRequest,

    @ClientIp()
    ipAddress: string | undefined,

    @UserAgent()
    userAgent: string | undefined,

    @RequestId()
    requestId: string | undefined,
  ): Promise<AuthorApplicationResponse> {
    const result = await this.rejectApplication.execute(
      new RejectAuthorApplicationCommand(
        applicationId,

        reviewerId,

        request.reason,

        ipAddress,

        userAgent,

        requestId,
      ),
    );

    return toAuthorApplicationResponse(result);
  }
}
