import type {
  ManagedUserDetailEntity,
  ManagedUserSummaryEntity,
} from '../../domain';

import type {
  ManagedUserDetailResultDto,
  ManagedUserSummaryResultDto,
} from '../dto';

export class ManagedUserResultMapper {
  static toSummaryDto(
    user: ManagedUserSummaryEntity,
  ): ManagedUserSummaryResultDto {
    return {
      id: user.id,

      email: user.email,

      username: user.username,

      displayName: user.displayName,

      status: user.status,

      emailVerified: user.emailVerifiedAt !== null,

      emailVerifiedAt: user.emailVerifiedAt,

      lastLoginAt: user.lastLoginAt,

      roles: user.roles.map((role) => ({
        code: role.code,

        name: role.name,

        assignedAt: role.assignedAt,

        expiresAt: role.expiresAt,
      })),

      createdAt: user.createdAt,

      updatedAt: user.updatedAt,
    };
  }

  static toDetailDto(
    user: ManagedUserDetailEntity,
  ): ManagedUserDetailResultDto {
    return {
      ...this.toSummaryDto(user),

      bio: user.bio,

      avatar: user.avatar,

      authorProfile: user.authorProfile,

      activeSessionCount: user.activeSessionCount,

      statusReason: user.statusReason,

      mfaEnabled: user.mfaEnabled,

      deletedAt: user.deletedAt,
    };
  }
}
