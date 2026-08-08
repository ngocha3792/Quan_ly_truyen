import { Prisma } from '@/generated/prisma/client';

/**
 * Projection profile cơ bản dùng chung cho:
 *
 * - GET /users/me
 * - GET /auth/me
 *
 * Auth có thể mở rộng projection này bằng:
 * - authorProfile
 * - roles
 * - permissions
 *
 * Users chỉ lấy phần profile.
 */
export const CURRENT_USER_PROFILE_SELECT = {
  id: true,

  email: true,

  username: true,

  displayName: true,

  bio: true,

  status: true,

  emailVerifiedAt: true,

  lastLoginAt: true,

  createdAt: true,

  updatedAt: true,

  avatarMedia: {
    select: {
      id: true,

      secureUrl: true,

      publicUrl: true,
    },
  },
} satisfies Prisma.UserSelect;

export type CurrentUserProfileRow = Prisma.UserGetPayload<{
  select: typeof CURRENT_USER_PROFILE_SELECT;
}>;
