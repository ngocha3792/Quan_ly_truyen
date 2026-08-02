import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import type { CurrentUserResultDto } from '../../dto';
import { CurrentUserResultMapper } from '../../mappers';
import {
  CURRENT_USER_READER_PORT,
  type CurrentUserReaderPort,
} from '../../ports';

import { GetCurrentUserQuery } from './get-current-user.query';

@Injectable()
export class GetCurrentUserQueryHandler {
  constructor(
    @Inject(CURRENT_USER_READER_PORT)
    private readonly currentUserReader: CurrentUserReaderPort,
  ) {}

  async execute(query: GetCurrentUserQuery): Promise<CurrentUserResultDto> {
    if (!isUuidV4(query.userId) || !isUuidV4(query.sessionId)) {
      throw this.authenticationRequired();
    }

    const user = await this.currentUserReader.findById(query.userId);

    if (!user) {
      throw this.authenticationRequired();
    }

    return CurrentUserResultMapper.toDto(user, query.sessionId);
  }

  private authenticationRequired(): AuthenticationRequiredException {
    return new AuthenticationRequiredException({
      code: 'AUTH_CURRENT_USER_UNAVAILABLE',

      message: 'Phiên đăng nhập không còn hiệu lực',
    });
  }
}
