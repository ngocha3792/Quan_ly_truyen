import { Inject, Injectable } from '@nestjs/common';

import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import { UserProfileUnavailableException } from '../../../domain';

import {
  USER_PROFILE_PERSISTENCE_PORT,
  USER_PROFILE_READER_PORT,
  type UserProfilePersistencePort,
  type UserProfileReaderPort,
} from '../../ports';

import type { UserPreferencesResultDto } from '../../dto';

import { UserPreferencesResultMapper } from '../../mappers';

import { UpdateCurrentUserPreferencesCommand } from './update-current-user-preferences.command';

@Injectable()
export class UpdateCurrentUserPreferencesCommandHandler {
  constructor(
    @Inject(USER_PROFILE_READER_PORT)
    private readonly reader: UserProfileReaderPort,

    @Inject(USER_PROFILE_PERSISTENCE_PORT)
    private readonly persistence: UserProfilePersistencePort,
  ) {}

  async execute(
    command: UpdateCurrentUserPreferencesCommand,
  ): Promise<UserPreferencesResultDto> {
    const userId = this.requireUserId(command.userId);

    this.validateOptionalBoolean(
      command.newChapterNotifications,
      'newChapterNotifications',
    );

    this.validateOptionalBoolean(
      command.showRecentActivity,
      'showRecentActivity',
    );

    this.validateOptionalBoolean(
      command.allowUpdateEmails,
      'allowUpdateEmails',
    );

    if (
      command.newChapterNotifications === undefined &&
      command.showRecentActivity === undefined &&
      command.allowUpdateEmails === undefined
    ) {
      const current = await this.reader.findPreferencesByUserId(userId);

      if (!current) {
        throw new UserProfileUnavailableException();
      }

      return UserPreferencesResultMapper.toDto(current);
    }

    const result = await this.persistence.updatePreferences({
      userId,

      newChapterNotifications: command.newChapterNotifications,

      showRecentActivity: command.showRecentActivity,

      allowUpdateEmails: command.allowUpdateEmails,

      changedAt: new Date(),

      audit: {
        ipAddress: command.ipAddress,

        userAgent: command.userAgent,

        requestId: command.requestId,
      },
    });

    if (result.status === 'user_not_found') {
      throw new UserProfileUnavailableException();
    }

    return UserPreferencesResultMapper.toDto(result.preferences);
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId || !isUuidV4(userId)) {
      throw new AuthenticationRequiredException({
        code: 'USER_AUTHENTICATION_REQUIRED',
        message: 'Bạn cần đăng nhập để cập nhật tùy chọn',
      });
    }

    return userId;
  }

  private validateOptionalBoolean(
    value: boolean | undefined,
    field: string,
  ): void {
    if (value !== undefined && typeof value !== 'boolean') {
      throw new InvalidInputException({
        code: 'USER_PREFERENCE_INVALID',

        message: 'Tùy chọn tài khoản không hợp lệ',

        details: {
          field,
        },
      });
    }
  }
}
