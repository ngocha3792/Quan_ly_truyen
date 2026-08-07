import type { RecoveryEmailStatusResultDto } from '../dto';

import type { RecoveryEmailStatusRecord } from '../ports';

export class RecoveryEmailStatusMapper {
  static toDto(
    record: RecoveryEmailStatusRecord,
  ): RecoveryEmailStatusResultDto {
    return {
      email: record.email,

      verified: record.email !== null && record.verifiedAt !== null,

      verifiedAt: record.verifiedAt,

      pendingEmail: record.pendingEmail,

      pendingExpiresAt: record.pendingExpiresAt,
    };
  }
}
