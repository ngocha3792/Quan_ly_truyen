import type { UserProfileEntity } from '../../domain';

import type { UserProfileResultDto } from '../dto';

export class UserProfileResultMapper {
  static toDto(profile: UserProfileEntity): UserProfileResultDto {
    return {
      id: profile.id,

      email: profile.email,

      username: profile.username,

      displayName: profile.displayName,

      bio: profile.bio,

      status: profile.status,

      emailVerified: profile.emailVerifiedAt !== null,

      emailVerifiedAt: profile.emailVerifiedAt,

      lastLoginAt: profile.lastLoginAt,

      avatar: profile.avatar
        ? {
            id: profile.avatar.id,
            url: profile.avatar.url,
          }
        : null,

      createdAt: profile.createdAt,

      updatedAt: profile.updatedAt,
    };
  }
}
