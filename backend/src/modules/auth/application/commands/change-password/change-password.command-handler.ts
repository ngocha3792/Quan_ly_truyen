import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import type { ChangePasswordResultDto } from '../../dto';

import { ChangePasswordResultMapper } from '../../mappers';

import {
  CHANGE_PASSWORD_PERSISTENCE_PORT,
  type ChangePasswordPersistencePort,
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '../../ports';

import {
  InvalidCurrentPasswordException,
  NewPasswordMustDifferException,
  PasswordChangeUnavailableException,
} from '../../../domain/exceptions';

import {
  CurrentPasswordValueObject,
  PasswordValueObject,
} from '../../../domain/value-objects';

import { ChangePasswordCommand } from './change-password.command';

@Injectable()
export class ChangePasswordCommandHandler {
  constructor(
    @Inject(CHANGE_PASSWORD_PERSISTENCE_PORT)
    private readonly persistence: ChangePasswordPersistencePort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    command: ChangePasswordCommand,
  ): Promise<ChangePasswordResultDto> {
    if (
      !command.userId ||
      !command.currentSessionId ||
      !isUuidV4(command.userId) ||
      !isUuidV4(command.currentSessionId)
    ) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_CURRENT_SESSION_REQUIRED',

        message: 'Phiên đăng nhập hiện tại không hợp lệ',
      });
    }

    const currentPassword = CurrentPasswordValueObject.create(
      command.currentPassword,
    );

    const newPassword = PasswordValueObject.create(command.newPassword);

    const credential = await this.persistence.findCredentialByUserId(
      command.userId,
    );

    if (!credential) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

        message: 'Tài khoản hiện tại không còn khả dụng',
      });
    }

    if (!credential.passwordHash) {
      throw new PasswordChangeUnavailableException();
    }

    /*
     * Kiểm tra mật khẩu hiện tại trước.
     */
    const currentPasswordMatches = await this.passwordHasher.verify(
      currentPassword.value,

      credential.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new InvalidCurrentPasswordException();
    }

    /*
     * Không cho đặt lại đúng mật khẩu đang dùng.
     *
     * Không so sánh plaintext trực tiếp vì mật khẩu
     * hiện tại có thể có cách biểu diễn khác.
     */
    const newPasswordMatchesCurrent = await this.passwordHasher.verify(
      newPassword.value,

      credential.passwordHash,
    );

    if (newPasswordMatchesCurrent) {
      throw new NewPasswordMustDifferException();
    }

    const nextPasswordHash = await this.passwordHasher.hash(newPassword.value);

    const result = await this.persistence.changePassword({
      userId: command.userId,

      currentSessionId: command.currentSessionId,

      expectedPasswordHash: credential.passwordHash,

      nextPasswordHash,

      changedAt: new Date(),
    });

    switch (result.status) {
      case 'changed':
        return ChangePasswordResultMapper.toDto(result);

      case 'current_session_unavailable':
        throw new AuthenticationRequiredException({
          code: 'AUTH_CURRENT_SESSION_UNAVAILABLE',

          message: 'Phiên đăng nhập hiện tại không còn hiệu lực',
        });

      case 'conflict':
      default:
        /*
         * Password hash đã thay đổi giữa lúc đọc
         * credential và lúc ghi transaction.
         *
         * Trả lỗi giống mật khẩu hiện tại sai,
         * tránh tiết lộ trạng thái race.
         */
        throw new InvalidCurrentPasswordException();
    }
  }
}
