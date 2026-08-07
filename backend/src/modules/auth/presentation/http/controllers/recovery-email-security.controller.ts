import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';

import type { Response } from 'express';

import { CurrentSessionId, CurrentUserId } from '@/common/decorators';

import { Idempotent } from '@/common/decorators/interceptor';

import {
  GetRecoveryEmailStatusQuery,
  GetRecoveryEmailStatusQueryHandler,
  RemoveRecoveryEmailCommand,
  RemoveRecoveryEmailCommandHandler,
  RequestRecoveryEmailCommand,
  RequestRecoveryEmailCommandHandler,
  ResendRecoveryEmailCommand,
  ResendRecoveryEmailCommandHandler,
  VerifyRecoveryEmailCommand,
  VerifyRecoveryEmailCommandHandler,
} from '../../../application';

import type { RecoveryEmailStatusResultDto } from '../../../application';

import { AuthCookieService } from '../cookies';

import {
  RemoveRecoveryEmailRequest,
  RequestRecoveryEmailRequest,
  VerifyRecoveryEmailRequest,
} from '../requests';

import type { RecoveryEmailResponse } from '../responses';

@Controller('auth/security/recovery-email')
export class RecoveryEmailSecurityController {
  constructor(
    private readonly getStatusQueryHandler: GetRecoveryEmailStatusQueryHandler,

    private readonly requestCommandHandler: RequestRecoveryEmailCommandHandler,

    private readonly verifyCommandHandler: VerifyRecoveryEmailCommandHandler,

    private readonly resendCommandHandler: ResendRecoveryEmailCommandHandler,

    private readonly removeCommandHandler: RemoveRecoveryEmailCommandHandler,

    private readonly authCookies: AuthCookieService,
  ) {}

  @Get()
  async getStatus(
    @CurrentUserId()
    userId: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<RecoveryEmailResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.getStatusQueryHandler.execute(
      new GetRecoveryEmailStatusQuery(userId),
    );

    return toResponse(result);
  }

  @Post('request')
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async request(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Body()
    request: RequestRecoveryEmailRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<RecoveryEmailResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.requestCommandHandler.execute(
      new RequestRecoveryEmailCommand(
        userId,

        sessionId,

        request.email,

        request.currentPassword,
      ),
    );

    return toResponse(result);
  }

  @Post('verify')
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async verify(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Body()
    request: VerifyRecoveryEmailRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<RecoveryEmailResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.verifyCommandHandler.execute(
      new VerifyRecoveryEmailCommand(
        userId,

        sessionId,

        request.code,
      ),
    );

    return toResponse(result);
  }

  @Post('resend')
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async resend(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<RecoveryEmailResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.resendCommandHandler.execute(
      new ResendRecoveryEmailCommand(
        userId,

        sessionId,
      ),
    );

    return toResponse(result);
  }

  @Delete()
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    sessionId: string | undefined,

    @Body()
    request: RemoveRecoveryEmailRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<RecoveryEmailResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.removeCommandHandler.execute(
      new RemoveRecoveryEmailCommand(
        userId,

        sessionId,

        request.currentPassword,
      ),
    );

    return toResponse(result);
  }
}

function toResponse(
  result: RecoveryEmailStatusResultDto,
): RecoveryEmailResponse {
  return {
    email: result.email,

    verified: result.verified,

    verifiedAt: result.verifiedAt?.toISOString() ?? null,

    pendingEmail: result.pendingEmail,

    pendingExpiresAt: result.pendingExpiresAt?.toISOString() ?? null,
  };
}
