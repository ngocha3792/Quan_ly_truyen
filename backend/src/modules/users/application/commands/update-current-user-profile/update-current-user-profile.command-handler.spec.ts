import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  InvalidUserAvatarException,
  UserProfileEntity,
  UserProfileUnavailableException,
} from '../../../domain';

import { UpdateCurrentUserProfileCommand } from './update-current-user-profile.command';

import { UpdateCurrentUserProfileCommandHandler } from './update-current-user-profile.command-handler';

describe('UpdateCurrentUserProfileCommandHandler', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  const avatarMediaId = '22222222-2222-4222-8222-222222222222';

  let reader: {
    findProfileByUserId: jest.Mock;
  };

  let persistence: {
    updateProfile: jest.Mock;
  };

  let handler: UpdateCurrentUserProfileCommandHandler;

  beforeEach(() => {
    reader = {
      findProfileByUserId: jest.fn(),
    };

    persistence = {
      updateProfile: jest.fn(),
    };

    handler = new UpdateCurrentUserProfileCommandHandler(
      reader as never,

      persistence as never,
    );
  });

  it('yêu cầu authenticated user UUID hợp lệ', async () => {
    await expect(
      handler.execute(
        new UpdateCurrentUserProfileCommand(
          undefined,
          'New Name',
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.updateProfile).not.toHaveBeenCalled();
  });

  it('từ chối avatar media id không hợp lệ', async () => {
    await expect(
      handler.execute(
        new UpdateCurrentUserProfileCommand(
          userId,
          undefined,
          undefined,
          'not-a-uuid',
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidUserAvatarException);

    expect(persistence.updateProfile).not.toHaveBeenCalled();
  });

  it('PATCH rỗng đọc profile hiện tại mà không tạo update/audit', async () => {
    reader.findProfileByUserId.mockResolvedValue(
      createProfile(),
    );

    const result = await handler.execute(
      new UpdateCurrentUserProfileCommand(
        userId,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(reader.findProfileByUserId).toHaveBeenCalledWith(userId);

    expect(persistence.updateProfile).not.toHaveBeenCalled();

    expect(result.id).toBe(userId);

    expect(result.displayName).toBe('Current User');
  });

  it('PATCH rỗng nhưng profile không tồn tại phải trả domain exception', async () => {
    reader.findProfileByUserId.mockResolvedValue(null);

    await expect(
      handler.execute(
        new UpdateCurrentUserProfileCommand(
          userId,
          undefined,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(UserProfileUnavailableException);

    expect(persistence.updateProfile).not.toHaveBeenCalled();
  });

  it('normalize profile rồi gửi audit context xuống persistence', async () => {
    persistence.updateProfile.mockResolvedValue({
      status: 'updated',

      profile: createProfile({
        displayName: 'Updated User',

        bio: 'Updated biography',

        avatar: {
          id: avatarMediaId,

          url: 'https://example.test/avatar.jpg',
        },
      }),
    });

    const result = await handler.execute(
      new UpdateCurrentUserProfileCommand(
        userId,

        '   Updated    User   ',

        '  Updated biography  ',

        avatarMediaId,

        '127.0.0.1',

        'Jest',

        'profile-update-request',
      ),
    );

    expect(persistence.updateProfile).toHaveBeenCalledWith({
      userId,

      displayName: 'Updated User',

      bio: 'Updated biography',

      avatarMediaId,

      changedAt: expect.any(Date) as unknown,

      audit: {
        ipAddress: '127.0.0.1',

        userAgent: 'Jest',

        requestId: 'profile-update-request',
      },
    });

    expect(result.displayName).toBe('Updated User');

    expect(result.bio).toBe('Updated biography');

    expect(result.avatar?.id).toBe(avatarMediaId);
  });

  it('cho phép clear bio và avatar', async () => {
    persistence.updateProfile.mockResolvedValue({
      status: 'updated',

      profile: createProfile({
        bio: null,
        avatar: null,
      }),
    });

    await handler.execute(
      new UpdateCurrentUserProfileCommand(
        userId,
        undefined,
        null,
        null,
      ),
    );

    expect(persistence.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        bio: null,
        avatarMediaId: null,
      }),
    );
  });

  it('map invalid_avatar persistence result thành domain exception', async () => {
    persistence.updateProfile.mockResolvedValue({
      status: 'invalid_avatar',
    });

    await expect(
      handler.execute(
        new UpdateCurrentUserProfileCommand(
          userId,
          undefined,
          undefined,
          avatarMediaId,
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidUserAvatarException);
  });

  it('map user_not_found persistence result thành domain exception', async () => {
    persistence.updateProfile.mockResolvedValue({
      status: 'user_not_found',
    });

    await expect(
      handler.execute(
        new UpdateCurrentUserProfileCommand(
          userId,
          'Updated User',
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(UserProfileUnavailableException);
  });
});

function createProfile(
  overrides: {
    displayName?: string;
    bio?: string | null;
    avatar?: {
      id: string;
      url: string | null;
    } | null;
  } = {},
): UserProfileEntity {
  const now = new Date('2026-08-09T00:00:00.000Z');
  return new UserProfileEntity(
    '11111111-1111-4111-8111-111111111111',
    'current@example.test',
    'current_user',
    overrides.displayName ?? 'Current User',
    overrides.bio === undefined
      ? 'Current biography'
      : overrides.bio,
    'ACTIVE',
    now,
    now,
    overrides.avatar === undefined
      ? null
      : overrides.avatar,
    now,
    now,
  );
}