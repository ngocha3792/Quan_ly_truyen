import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import { UserProfileUnavailableException } from '../../../domain';

import {
  USER_PROFILE_READER_PORT,
  type UserProfileReaderPort,
} from '../../ports';

import type { UserProfileResultDto } from '../../dto';

import { UserProfileResultMapper } from '../../mappers';

import { GetCurrentUserProfileQuery } from './get-current-user-profile.query';

@Injectable()
export class GetCurrentUserProfileQueryHandler {
  constructor(
    @Inject(USER_PROFILE_READER_PORT)
    private readonly reader: UserProfileReaderPort,
  ) {}

  async execute(
    query: GetCurrentUserProfileQuery,
  ): Promise<UserProfileResultDto> {
    if (!query.userId || !isUuidV4(query.userId)) {
      throw new AuthenticationRequiredException({
        code: 'USER_AUTHENTICATION_REQUIRED',
        message: 'Bạn cần đăng nhập để xem hồ sơ',
      });
    }

    const profile = await this.reader.findProfileByUserId(query.userId);

    if (!profile) {
      throw new UserProfileUnavailableException();
    }

    return UserProfileResultMapper.toDto(profile);
  }
}
