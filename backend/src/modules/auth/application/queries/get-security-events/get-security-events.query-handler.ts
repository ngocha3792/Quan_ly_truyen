import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import type { AuthConfig } from '@/config';

import type { GetSecurityEventsResultDto } from '../../dto';

import { SecurityEventResultMapper } from '../../mappers';

import { AUTH_AUDIT_READER_PORT, type AuthAuditReaderPort } from '../../ports';

import { GetSecurityEventsQuery } from './get-security-events.query';

@Injectable()
export class GetSecurityEventsQueryHandler {
  private readonly maximumLimit: number;

  constructor(
    @Inject(AUTH_AUDIT_READER_PORT)
    private readonly auditReader: AuthAuditReaderPort,

    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AuthConfig>('auth');

    this.maximumLimit = config.audit.historyLimit;
  }

  async execute(
    query: GetSecurityEventsQuery,
  ): Promise<GetSecurityEventsResultDto> {
    if (!isUuidV4(query.userId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_PRINCIPAL_REQUIRED',

        message: 'Không tìm thấy người dùng đã xác thực',
      });
    }

    if (
      !Number.isSafeInteger(query.requestedLimit) ||
      query.requestedLimit <= 0
    ) {
      throw new InvalidInputException({
        code: 'AUTH_SECURITY_EVENT_LIMIT_INVALID',

        message: 'Giới hạn security event không hợp lệ',

        details: {
          field: 'limit',
        },
      });
    }

    const limit = Math.min(
      query.requestedLimit,

      this.maximumLimit,
    );

    const records = await this.auditReader.listByUserId(
      query.userId,

      limit,
    );

    return {
      events: records.map((record) => SecurityEventResultMapper.toDto(record)),

      total: records.length,
    };
  }
}
