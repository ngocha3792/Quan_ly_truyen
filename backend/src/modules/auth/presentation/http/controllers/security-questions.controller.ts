import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Res,
} from '@nestjs/common';

import type { Response } from 'express';

import { CurrentSessionId, CurrentUserId } from '@/common/decorators';

import { Idempotent } from '@/common/decorators/interceptor';

import {
  GetSecurityQuestionCatalogQuery,
  GetSecurityQuestionCatalogQueryHandler,
  GetSecurityQuestionsQuery,
  GetSecurityQuestionsQueryHandler,
  RemoveSecurityQuestionsCommand,
  RemoveSecurityQuestionsCommandHandler,
  UpdateSecurityQuestionsCommand,
  UpdateSecurityQuestionsCommandHandler,
} from '../../../application';

import type {
  SecurityQuestionOptionResultDto,
  SecurityQuestionsStateResultDto,
} from '../../../application';

import { AuthCookieService } from '../cookies';

import {
  RemoveSecurityQuestionsRequest,
  UpdateSecurityQuestionsRequest,
} from '../requests';

import type {
  SecurityQuestionOptionResponse,
  SecurityQuestionsStateResponse,
} from '../responses';

@Controller('auth/security/questions')
export class SecurityQuestionsController {
  constructor(
    private readonly getCatalogQueryHandler: GetSecurityQuestionCatalogQueryHandler,

    private readonly getStateQueryHandler: GetSecurityQuestionsQueryHandler,

    private readonly updateCommandHandler: UpdateSecurityQuestionsCommandHandler,

    private readonly removeCommandHandler: RemoveSecurityQuestionsCommandHandler,

    private readonly authCookies: AuthCookieService,
  ) {}

  @Get('catalog')
  async getCatalog(
    @CurrentUserId()
    userId: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<readonly SecurityQuestionOptionResponse[]> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.getCatalogQueryHandler.execute(
      new GetSecurityQuestionCatalogQuery(
        userId,

        'vi',
      ),
    );

    return result.map(toCatalogResponse);
  }

  @Get()
  async getState(
    @CurrentUserId()
    userId: string | undefined,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<SecurityQuestionsStateResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.getStateQueryHandler.execute(
      new GetSecurityQuestionsQuery(userId),
    );

    return toStateResponse(result);
  }

  @Put()
  @Idempotent({
    required: true,

    ttlSeconds: 300,
  })
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUserId()
    userId: string | undefined,

    @CurrentSessionId()
    currentSessionId: string | undefined,

    @Body()
    request: UpdateSecurityQuestionsRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<SecurityQuestionsStateResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.updateCommandHandler.execute(
      new UpdateSecurityQuestionsCommand(
        userId,

        currentSessionId,

        request.currentPassword,

        request.answers,
      ),
    );

    return toStateResponse(result);
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
    currentSessionId: string | undefined,

    @Body()
    request: RemoveSecurityQuestionsRequest,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<SecurityQuestionsStateResponse> {
    this.authCookies.setNoStoreHeaders(response);

    const result = await this.removeCommandHandler.execute(
      new RemoveSecurityQuestionsCommand(
        userId,

        currentSessionId,

        request.currentPassword,
      ),
    );

    return toStateResponse(result);
  }
}

function toCatalogResponse(
  result: SecurityQuestionOptionResultDto,
): SecurityQuestionOptionResponse {
  return {
    id: result.id,

    label: result.label,
  };
}

function toStateResponse(
  result: SecurityQuestionsStateResultDto,
): SecurityQuestionsStateResponse {
  return {
    configured: result.configured,

    questions: result.questions.map((question) => ({
      id: question.id,

      questionId: question.questionId,

      label: question.label,

      updatedAt: question.updatedAt.toISOString(),
    })),

    updatedAt: result.updatedAt?.toISOString() ?? null,
  };
}
