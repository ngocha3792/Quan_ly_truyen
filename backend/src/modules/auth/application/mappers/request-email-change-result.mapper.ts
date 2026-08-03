import type { RequestEmailChangeResultDto } from '../dto';

export class RequestEmailChangeResultMapper {
  static toDto(
    newEmail: string,

    expiresAt: Date,
  ): RequestEmailChangeResultDto {
    return {
      emailChangeRequested: true,

      pendingEmail: newEmail,

      verificationRequired: true,

      expiresAt,
    };
  }
}
