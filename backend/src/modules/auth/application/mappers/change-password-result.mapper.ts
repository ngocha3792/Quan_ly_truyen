import type { ChangePasswordResultDto } from '../dto';

import type { ChangePasswordSuccess } from '../ports';

export class ChangePasswordResultMapper {
  static toDto(result: ChangePasswordSuccess): ChangePasswordResultDto {
    return {
      passwordChanged: true,

      otherSessionsRevoked: result.otherSessionsRevoked,

      currentSessionKept: true,

      accessTokenInvalidated: true,

      refreshRequired: true,

      changedAt: result.changedAt,
    };
  }
}
