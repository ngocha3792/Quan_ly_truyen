import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import type {
  SecurityQuestionOptionResultDto,
  SecurityQuestionsStateResultDto,
} from '../../dto';

import { SecurityQuestionsMapper } from '../../mappers';

import {
  SECURITY_QUESTIONS_PERSISTENCE_PORT,
  type SecurityQuestionsPersistencePort,
} from '../../ports';

import {
  GetSecurityQuestionCatalogQuery,
  GetSecurityQuestionsQuery,
} from './security-questions.queries';

function requireUserId(value: string | undefined): string {
  if (!value || !isUuidV4(value)) {
    throw new AuthenticationRequiredException({
      code: 'AUTH_SECURITY_QUESTIONS_AUTH_REQUIRED',

      message: 'Bạn cần đăng nhập để quản lý câu hỏi bảo mật',
    });
  }

  return value;
}

@Injectable()
export class GetSecurityQuestionCatalogQueryHandler {
  constructor(
    @Inject(SECURITY_QUESTIONS_PERSISTENCE_PORT)
    private readonly persistence: SecurityQuestionsPersistencePort,
  ) {}

  async execute(
    query: GetSecurityQuestionCatalogQuery,
  ): Promise<readonly SecurityQuestionOptionResultDto[]> {
    requireUserId(query.userId);

    const records = await this.persistence.findCatalog(query.locale);

    return SecurityQuestionsMapper.catalogToDto(records);
  }
}

@Injectable()
export class GetSecurityQuestionsQueryHandler {
  constructor(
    @Inject(SECURITY_QUESTIONS_PERSISTENCE_PORT)
    private readonly persistence: SecurityQuestionsPersistencePort,
  ) {}

  async execute(
    query: GetSecurityQuestionsQuery,
  ): Promise<SecurityQuestionsStateResultDto> {
    const userId = requireUserId(query.userId);

    const record = await this.persistence.findStateByUserId(userId);

    if (!record) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

        message: 'Tài khoản hiện tại không còn khả dụng',
      });
    }

    return SecurityQuestionsMapper.stateToDto(record);
  }
}
