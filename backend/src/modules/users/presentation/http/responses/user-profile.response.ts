import type {
    UserProfileResultDto,
} from '../../../application';

export interface UserProfileResponse {
    readonly id: string;

    readonly email: string;

    readonly username: string;

    readonly displayName: string;

    readonly bio: string | null;

    readonly status: string;

    readonly emailVerified: boolean;

    readonly emailVerifiedAt: string | null;

    readonly lastLoginAt: string | null;

    readonly avatar: {
        readonly id: string;
        readonly url: string | null;
    } | null;

    readonly createdAt: string;

    readonly updatedAt: string;
}

export function toUserProfileResponse(
    result:
        UserProfileResultDto,
): UserProfileResponse {
    return {
        id:
            result.id,

        email:
            result.email,

        username:
            result.username,

        displayName:
            result.displayName,

        bio:
            result.bio,

        status:
            result.status,

        emailVerified:
            result.emailVerified,

        emailVerifiedAt:
            result.emailVerifiedAt?.toISOString() ??
            null,

        lastLoginAt:
            result.lastLoginAt?.toISOString() ??
            null,

        avatar:
            result.avatar,

        createdAt:
            result.createdAt.toISOString(),

        updatedAt:
            result.updatedAt.toISOString(),
    };
}