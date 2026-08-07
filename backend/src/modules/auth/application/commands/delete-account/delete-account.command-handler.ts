import { Inject, Injectable } from '@nestjs/common';

import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import {
  ACCOUNT_DELETION_PERSISTENCE_PORT,
  type AccountDeletionPersistencePort,
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
} from '../../ports';

import {
  AccountDeletionUnavailableException,
  InvalidCurrentPasswordException,
} from '../../../domain/exceptions';

import { CurrentPasswordValueObject } from '../../../domain/value-objects';

import { DeleteAccountCommand } from './delete-account.command';

const ACCOUNT_DELETION_CONFIRMATION = 'XOA TAI KHOAN';

@Injectable()
export class DeleteAccountCommandHandler {
  constructor(
    @Inject(ACCOUNT_DELETION_PERSISTENCE_PORT)
    private readonly persistence: AccountDeletionPersistencePort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(command: DeleteAccountCommand): Promise<void> {
    /*
     * Delete account là sensitive action.
     * Bắt buộc phải có current authenticated
     * user + current session hợp lệ.
     */
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

    /*
     * DTO đã validate nhưng application layer
     * vẫn tự bảo vệ nếu command được gọi từ
     * transport khác trong tương lai.
     */
    if (command.confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
      throw new InvalidInputException({
        code: 'AUTH_ACCOUNT_DELETION_CONFIRMATION_INVALID',

        message: 'Nội dung xác nhận xóa tài khoản không chính xác',

        details: {
          field: 'confirmation',
        },
      });
    }

    const currentPassword = CurrentPasswordValueObject.create(command.password);

    const credential = await this.persistence.findCredentialByUserId(
      command.userId,
    );

    if (!credential) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

        message: 'Tài khoản hiện tại không còn khả dụng',
      });
    }

    /*
     * OAuth-only account chưa có password.
     *
     * Flow hiện tại chưa có sensitive-action
     * challenge bằng OAuth/MFA nên không cho
     * delete qua password form.
     */
    if (!credential.passwordHash) {
      throw new AccountDeletionUnavailableException();
    }

    const passwordMatches = await this.passwordHasher.verify(
      currentPassword.value,

      credential.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCurrentPasswordException();
    }

    const result = await this.persistence.deleteAccount({
      userId: command.userId,

      currentSessionId: command.currentSessionId,

      expectedPasswordHash: credential.passwordHash,

      deletedAt: new Date(),

      requestIp: command.requestIp,

      requestUserAgent: command.requestUserAgent,
    });

    switch (result.status) {
      case 'deleted':
        return;

      case 'current_session_unavailable':
        throw new AuthenticationRequiredException({
          code: 'AUTH_CURRENT_SESSION_UNAVAILABLE',

          message: 'Phiên đăng nhập hiện tại không còn hiệu lực',
        });

      case 'conflict':
      default:
        /*
         * Password/account state đã thay đổi
         * sau bước verify.
         *
         * Trả giống password sai để không leak
         * thông tin race-condition.
         */
        throw new InvalidCurrentPasswordException();
    }
  }
}
