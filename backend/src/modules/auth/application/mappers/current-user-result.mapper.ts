import type { CurrentUserResultDto } from '../dto';
import type { CurrentUserRecord } from '../ports';

export class CurrentUserResultMapper {
  static toDto(
    user: CurrentUserRecord,
    sessionId: string,
  ): CurrentUserResultDto {
    return {
      id: user.id,
      sessionId,

      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,

      status: user.status,

      emailVerified: user.emailVerifiedAt !== null,

      emailVerifiedAt: user.emailVerifiedAt,

      lastLoginAt: user.lastLoginAt,

      avatar: user.avatar
        ? {
            id: user.avatar.id,
            url: user.avatar.url,
          }
        : null,

      authorProfile: user.authorProfile
        ? {
            id: user.authorProfile.id,

            penName: user.authorProfile.penName,

            verificationStatus: user.authorProfile.verificationStatus,
          }
        : null,

      roles: [...user.roles],

      permissions: [...user.permissions],

      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
