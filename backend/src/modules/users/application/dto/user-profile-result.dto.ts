export interface UserProfileResultDto {
    readonly id: string;

    readonly email: string;

    readonly username: string;

    readonly displayName: string;

    readonly bio: string | null;

    readonly status: string;

    readonly emailVerified: boolean;

    readonly emailVerifiedAt: Date | null;

    readonly lastLoginAt: Date | null;

    readonly avatar: {
        readonly id: string;
        readonly url: string | null;
    } | null;

    readonly createdAt: Date;

    readonly updatedAt: Date;
}