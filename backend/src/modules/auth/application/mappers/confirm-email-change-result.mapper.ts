import type { ConfirmEmailChangeResultDto } from '../dto';

import type { EmailChangeSuccess } from '../ports';

export class ConfirmEmailChangeResultMapper {
  static toDto(
    result: EmailChangeSuccess,

    alreadyChanged: boolean,
  ): ConfirmEmailChangeResultDto {
    return {
      emailChanged: true,

      alreadyChanged,

      previousEmail: result.previousEmail,

      email: result.email,

      sessionsRevoked: result.sessionsRevoked,

      reauthenticationRequired: true,

      changedAt: result.changedAt,
    };
  }
}
