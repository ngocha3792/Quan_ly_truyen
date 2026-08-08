export interface UserProfileAvatar {
  readonly id: string;
  readonly url: string | null;
}

export class UserProfileEntity {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly username: string,
    readonly displayName: string,
    readonly bio: string | null,
    readonly status: string,
    readonly emailVerifiedAt: Date | null,
    readonly lastLoginAt: Date | null,
    readonly avatar: UserProfileAvatar | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
