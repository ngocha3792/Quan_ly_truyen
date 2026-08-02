import type { ResetPasswordResultDto } from '../dto';
import type { PasswordResetSuccess } from '../ports';

export class ResetPasswordResultMapper {
  static toDto(result: PasswordResetSuccess): ResetPasswordResultDto {
    return {
      passwordReset: true,

      sessionsRevoked: result.sessionsRevoked,

      resetAt: result.resetAt,
    };
  }
}
