import type { VerifyEmailResultDto } from '../dto';
import type { EmailVerificationSuccess } from '../ports';

export class VerifyEmailResultMapper {
  static toDto(
    result: EmailVerificationSuccess,
    alreadyVerified: boolean,
  ): VerifyEmailResultDto {
    return {
      emailVerified: true,
      alreadyVerified,
      verifiedAt: result.verifiedAt,
    };
  }
}
