import type { SessionResultDto } from '../dto';
import type { ManagedSessionRecord } from '../ports';

export class SessionResultMapper {
  static toDto(
    session: ManagedSessionRecord,
    currentSessionId: string,
  ): SessionResultDto {
    return {
      id: session.id,

      isCurrent: session.id === currentSessionId,

      deviceId: session.deviceId,
      deviceName: session.deviceName,

      ipAddress: session.ipAddress,
      userAgent: session.userAgent,

      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  }
}
