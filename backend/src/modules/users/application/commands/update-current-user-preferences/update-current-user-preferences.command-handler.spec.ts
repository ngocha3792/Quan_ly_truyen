import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';

import {
  UserPreferencesEntity,
  UserProfileUnavailableException,
} from '../../../domain';

import { UpdateCurrentUserPreferencesCommand } from './update-current-user-preferences.command';

import { UpdateCurrentUserPreferencesCommandHandler } from './update-current-user-preferences.command-handler';

describe('UpdateCurrentUserPreferencesCommandHandler', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  let reader: {
    findPreferencesByUserId: jest.Mock;
  };

  let persistence: {
    updatePreferences: jest.Mock;
  };

  let handler: UpdateCurrentUserPreferencesCommandHandler;

  beforeEach(() => {
    reader = {
      findPreferencesByUserId: jest.fn(),
    };

    persistence = {
      updatePreferences: jest.fn(),
    };

    handler = new UpdateCurrentUserPreferencesCommandHandler(
      reader as never,
      persistence as never,
    );
  });

  it('yêu cầu authenticated user UUID hợp lệ', async () => {
    await expect(
      handler.execute(
        new UpdateCurrentUserPreferencesCommand(
          undefined,
          true,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.updatePreferences).not.toHaveBeenCalled();
  });

  it.each([
    ['newChapterNotifications', 'yes', undefined, undefined],
    ['showRecentActivity', undefined, 'yes', undefined],
    ['allowUpdateEmails', undefined, undefined, 'yes'],  ])(
    'từ chối %s nếu không phải boolean',
    async (
      _field,
      newChapterNotifications,
      showRecentActivity,
      allowUpdateEmails,
    ) => {      await expect(
        handler.execute(
          new UpdateCurrentUserPreferencesCommand(
            userId,
            newChapterNotifications as unknown as boolean,
            showRecentActivity as unknown as boolean,
            allowUpdateEmails as unknown as boolean,          ),        ),      ).rejects.toBeInstanceOf(InvalidInputException);      expect(persistence.updatePreferences).not.toHaveBeenCalled();    },  );  it('PATCH rỗng đọc preferences hiện tại mà không ghi database', async () => {    reader.findPreferencesByUserId.mockResolvedValue(      createPreferences(),    );    const result = await handler.execute(      new UpdateCurrentUserPreferencesCommand(        userId,        undefined,        undefined,        undefined,      ),    );    expect(reader.findPreferencesByUserId).toHaveBeenCalledWith(userId);    expect(persistence.updatePreferences).not.toHaveBeenCalled();    expect(result).toEqual({      newChapterNotifications: true,      showRecentActivity: true,      allowUpdateEmails: true,      updatedAt: expect.any(Date),    });  });  it('PATCH rỗng nhưng user không tồn tại phải fail', async () => {    reader.findPreferencesByUserId.mockResolvedValue(null);    await expect(      handler.execute(        new UpdateCurrentUserPreferencesCommand(          userId,          undefined,          undefined,          undefined,        ),      ),    ).rejects.toBeInstanceOf(UserProfileUnavailableException);  });  it('update partial preferences và giữ undefined cho field không đổi', async () => {    persistence.updatePreferences.mockResolvedValue({      status: 'updated',      preferences: createPreferences({        newChapterNotifications: false,        showRecentActivity: true,        allowUpdateEmails: false,      }),    });    const result = await handler.execute(      new UpdateCurrentUserPreferencesCommand(        userId,        false,        undefined,        false,        '127.0.0.1',        'Jest',        'preferences-request',      ),    );    expect(persistence.updatePreferences).toHaveBeenCalledWith({      userId,      newChapterNotifications: false,      showRecentActivity: undefined,      allowUpdateEmails: false,      changedAt: expect.any(Date) as unknown,      audit: {        ipAddress: '127.0.0.1',        userAgent: 'Jest',        requestId: 'preferences-request',      },    });    expect(result.newChapterNotifications).toBe(false);    expect(result.showRecentActivity).toBe(true);    expect(result.allowUpdateEmails).toBe(false);  });  it('map user_not_found thành domain exception', async () => {    persistence.updatePreferences.mockResolvedValue({      status: 'user_not_found',    });    await expect(      handler.execute(        new UpdateCurrentUserPreferencesCommand(          userId,          true,          undefined,          undefined,        ),      ),    ).rejects.toBeInstanceOf(UserProfileUnavailableException);  });});function createPreferences(  overrides: {    newChapterNotifications?: boolean;    showRecentActivity?: boolean;    allowUpdateEmails?: boolean;  } = {},): UserPreferencesEntity {  return new UserPreferencesEntity(    overrides.newChapterNotifications ?? true,    overrides.showRecentActivity ?? true,    overrides.allowUpdateEmails ?? true,    new Date('2026-08-09T00:00:00.000Z'),  );}