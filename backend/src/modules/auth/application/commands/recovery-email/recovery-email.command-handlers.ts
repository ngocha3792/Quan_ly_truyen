import { Inject, Injectable } from '@nestjs/common';

import {
  AccessDeniedException,
  AuthenticationRequiredException,
  InvalidInputException,
  InvalidOperationException,
  InvalidTokenException,
  RateLimitExceededException,
  ResourceConflictException,
  ResourceGoneException,
} from '@/common/exceptions';

import { generateNumericCode, isUuidV4 } from '@/common/utils';

import type { RecoveryEmailStatusResultDto } from '../../dto';

import { RecoveryEmailStatusMapper } from '../../mappers';

import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
  RECOVERY_EMAIL_PERSISTENCE_PORT,
  type RecoveryEmailPersistencePort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';

import { InvalidCurrentPasswordException } from '../../../domain/exceptions';

import { RecoveryEmailPolicy } from '../../../domain/policies';

import {
  CurrentPasswordValueObject,
  EmailValueObject,
} from '../../../domain/value-objects';

import {
  RemoveRecoveryEmailCommand,
  RequestRecoveryEmailCommand,
  ResendRecoveryEmailCommand,
  VerifyRecoveryEmailCommand,
} from './recovery-email.commands';

function requireUserId(value: string | undefined): string {
  if (!value || !isUuidV4(value)) {
    throw new AuthenticationRequiredException({
      code: 'AUTH_RECOVERY_EMAIL_AUTH_REQUIRED',

      message: 'Bạn cần đăng nhập để quản lý email khôi phục',
    });
  }

  return value;
}

function unavailable(): AccessDeniedException {
  return new AccessDeniedException({
    code: 'AUTH_RECOVERY_EMAIL_PASSWORD_REQUIRED',

    message: 'Tài khoản cần có mật khẩu trước khi cấu hình email khôi phục',
  });
}

function emailInUse(): ResourceConflictException {
  return new ResourceConflictException({
    code: 'AUTH_RECOVERY_EMAIL_IN_USE',

    message: 'Email này không thể được sử dụng làm email khôi phục',

    field: 'email',
  });
}

@Injectable()
export class RequestRecoveryEmailCommandHandler {
  constructor(
    @Inject(RECOVERY_EMAIL_PERSISTENCE_PORT)
    private readonly persistence: RecoveryEmailPersistencePort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,

    @Inject(ID_GENERATOR_PORT)
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(
    command: RequestRecoveryEmailCommand,
  ): Promise<RecoveryEmailStatusResultDto> {
    const userId = requireUserId(command.userId);

    const email = EmailValueObject.create(command.email);

    const currentPassword = CurrentPasswordValueObject.create(
      command.currentPassword,
    );

    const credential = await this.persistence.findCredentialByUserId(userId);

    if (!credential) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

        message: 'Tài khoản hiện tại không còn khả dụng',
      });
    }

    if (!credential.passwordHash) {
      throw unavailable();
    }

    if (credential.primaryEmail.toLowerCase() === email.value) {
      throw new InvalidInputException({
        code: 'AUTH_RECOVERY_EMAIL_MUST_DIFFER',

        message: 'Email khôi phục phải khác email đăng nhập chính',

        details: {
          field: 'email',
        },
      });
    }

    const passwordMatches = await this.passwordHasher.verify(
      currentPassword.value,

      credential.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCurrentPasswordException();
    }

    const rawCode = generateNumericCode(RecoveryEmailPolicy.CODE_LENGTH);

    const requestedAt = new Date();

    const result = await this.persistence.request({
      operationId: this.idGenerator.generate(),

      userId,

      currentSessionId: command.currentSessionId,

      expectedPrimaryEmail: credential.primaryEmail,

      expectedPasswordHash: credential.passwordHash,

      recoveryEmail: email.value,

      rawCode,

      codeHash: this.secureToken.hash(rawCode),

      requestedAt,

      expiresAt: RecoveryEmailPolicy.createExpiresAt(requestedAt),

      expiresInMinutes: RecoveryEmailPolicy.TTL_MINUTES,
    });

    switch (result.status) {
      case 'requested':
        return RecoveryEmailStatusMapper.toDto(result.value);

      case 'same_as_primary':
        throw new InvalidInputException({
          code: 'AUTH_RECOVERY_EMAIL_MUST_DIFFER',

          message: 'Email khôi phục phải khác email đăng nhập chính',

          details: {
            field: 'email',
          },
        });

      case 'same_as_current':
        throw new ResourceConflictException({
          code: 'AUTH_RECOVERY_EMAIL_ALREADY_CONFIGURED',

          message: 'Email này đã là email khôi phục hiện tại',

          field: 'email',
        });

      case 'email_in_use':
        throw emailInUse();

      case 'account_unavailable':
        throw new AuthenticationRequiredException({
          code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

          message: 'Tài khoản hiện tại không còn khả dụng',
        });

      case 'conflict':
      default:
        throw new InvalidCurrentPasswordException();
    }
  }
}

@Injectable()
export class VerifyRecoveryEmailCommandHandler {
  constructor(
    @Inject(RECOVERY_EMAIL_PERSISTENCE_PORT)
    private readonly persistence: RecoveryEmailPersistencePort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(
    command: VerifyRecoveryEmailCommand,
  ): Promise<RecoveryEmailStatusResultDto> {
    const userId = requireUserId(command.userId);

    const code = command.code.trim();

    if (
      !new RegExp(`^\\d{${RecoveryEmailPolicy.CODE_LENGTH}}$`, 'u').test(code)
    ) {
      throw new InvalidTokenException({
        code: 'AUTH_RECOVERY_EMAIL_CODE_INVALID',

        message: 'Mã xác minh email khôi phục không hợp lệ',
      });
    }

    const result = await this.persistence.verify({
      userId,

      currentSessionId: command.currentSessionId,

      codeHash: this.secureToken.hash(code),

      verifiedAt: new Date(),

      maxAttempts: RecoveryEmailPolicy.MAX_VERIFICATION_ATTEMPTS,
    });

    switch (result.status) {
      case 'verified':
        return RecoveryEmailStatusMapper.toDto(result.value);

      case 'invalid':
        throw new InvalidTokenException({
          code: 'AUTH_RECOVERY_EMAIL_CODE_INVALID',

          message: 'Mã xác minh email khôi phục không chính xác',

          details: {
            attemptsRemaining: result.attemptsRemaining,
          },
        });

      case 'expired':
        throw new ResourceGoneException({
          code: 'AUTH_RECOVERY_EMAIL_CODE_EXPIRED',

          message: 'Mã xác minh email khôi phục đã hết hạn',

          resource: 'recovery-email-code',

          details: {
            expiresAt: result.expiresAt.toISOString(),
          },
        });

      case 'attempts_exceeded':
        throw new RateLimitExceededException({
          code: 'AUTH_RECOVERY_EMAIL_ATTEMPTS_EXCEEDED',

          message:
            'Bạn đã nhập sai mã xác minh quá nhiều lần. Hãy gửi lại mã mới.',

          limit: RecoveryEmailPolicy.MAX_VERIFICATION_ATTEMPTS,
        });

      case 'no_pending':
        throw new InvalidOperationException({
          code: 'AUTH_RECOVERY_EMAIL_NO_PENDING',

          message: 'Không có email khôi phục nào đang chờ xác minh',
        });

      case 'email_in_use':
      default:
        throw emailInUse();
    }
  }
}

@Injectable()
export class ResendRecoveryEmailCommandHandler {
  constructor(
    @Inject(RECOVERY_EMAIL_PERSISTENCE_PORT)
    private readonly persistence: RecoveryEmailPersistencePort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,

    @Inject(ID_GENERATOR_PORT)
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(
    command: ResendRecoveryEmailCommand,
  ): Promise<RecoveryEmailStatusResultDto> {
    const userId = requireUserId(command.userId);

    const rawCode = generateNumericCode(RecoveryEmailPolicy.CODE_LENGTH);

    const requestedAt = new Date();

    const result = await this.persistence.resend({
      operationId: this.idGenerator.generate(),

      userId,

      currentSessionId: command.currentSessionId,

      rawCode,

      codeHash: this.secureToken.hash(rawCode),

      requestedAt,

      expiresAt: RecoveryEmailPolicy.createExpiresAt(requestedAt),

      expiresInMinutes: RecoveryEmailPolicy.TTL_MINUTES,

      cooldownSeconds: RecoveryEmailPolicy.RESEND_COOLDOWN_SECONDS,

      maxResends: RecoveryEmailPolicy.MAX_RESENDS,
    });

    switch (result.status) {
      case 'sent':
        return RecoveryEmailStatusMapper.toDto(result.value);

      case 'no_pending':
        throw new InvalidOperationException({
          code: 'AUTH_RECOVERY_EMAIL_NO_PENDING',

          message: 'Không có email khôi phục nào đang chờ xác minh',
        });

      case 'too_soon':
        throw new RateLimitExceededException({
          code: 'AUTH_RECOVERY_EMAIL_RESEND_TOO_SOON',

          message: 'Vui lòng chờ trước khi gửi lại mã xác minh',

          retryAfterSeconds: result.retryAfterSeconds,
        });

      case 'resend_limit':
        throw new RateLimitExceededException({
          code: 'AUTH_RECOVERY_EMAIL_RESEND_LIMIT',

          message:
            'Bạn đã gửi lại mã quá nhiều lần. Hãy thiết lập email khôi phục lại sau.',

          limit: RecoveryEmailPolicy.MAX_RESENDS,
        });

      case 'email_in_use':
        throw emailInUse();

      case 'conflict':
      default:
        throw new ResourceConflictException({
          code: 'AUTH_RECOVERY_EMAIL_CHANGED_CONCURRENTLY',

          message:
            'Trạng thái email khôi phục đã thay đổi. Vui lòng tải lại trang.',
        });
    }
  }
}

@Injectable()
export class RemoveRecoveryEmailCommandHandler {
  constructor(
    @Inject(RECOVERY_EMAIL_PERSISTENCE_PORT)
    private readonly persistence: RecoveryEmailPersistencePort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    command: RemoveRecoveryEmailCommand,
  ): Promise<RecoveryEmailStatusResultDto> {
    const userId = requireUserId(command.userId);

    const currentPassword = CurrentPasswordValueObject.create(
      command.currentPassword,
    );

    const credential = await this.persistence.findCredentialByUserId(userId);

    if (!credential) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

        message: 'Tài khoản hiện tại không còn khả dụng',
      });
    }

    if (!credential.passwordHash) {
      throw unavailable();
    }

    const passwordMatches = await this.passwordHasher.verify(
      currentPassword.value,

      credential.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCurrentPasswordException();
    }

    const result = await this.persistence.remove({
      userId,

      currentSessionId: command.currentSessionId,

      expectedPasswordHash: credential.passwordHash,

      removedAt: new Date(),
    });

    switch (result.status) {
      case 'removed':
        return RecoveryEmailStatusMapper.toDto(result.value);

      case 'account_unavailable':
        throw new AuthenticationRequiredException({
          code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

          message: 'Tài khoản hiện tại không còn khả dụng',
        });

      case 'conflict':
      default:
        throw new InvalidCurrentPasswordException();
    }
  }
}
