import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { RoleCode } from '@/common/enums';

import {
  AccessDeniedException,
  AuthenticationRequiredException,
  InvalidTokenException,
  ResourceConflictException,
} from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import type { AuthConfig } from '@/config';

import type {
  LoginResultDto,
  MfaAuthenticatedResultDto,
  MfaEnrollmentResultDto,
  MfaRecoveryCodesResultDto,
  MfaSettingsConfirmationResultDto,
  MfaSettingsEnrollmentResultDto,
  MfaStatusDto,
} from '../../application/dto';

import { LoginResultMapper } from '../../application/mappers';

import {
  AUTH_TOKEN_ISSUER_PORT,
  type AuthTokenIssuerPort,
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
  LOGIN_PERSISTENCE_PORT,
  type LoginAccountRecord,
  type LoginPersistencePort,
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
  type MfaPort,
} from '../../application/ports';

import type { LoginClientContext } from '../../application/commands/login/login.command';

import {
  InvalidCurrentPasswordException,
  InvalidMfaCodeException,
  InvalidMfaTicketException,
} from '../../domain/exceptions';

import { AccountLoginPolicy } from '../../domain/policies';

import { CurrentPasswordValueObject } from '../../domain/value-objects';

import { MfaSecretCipherAdapter } from './mfa-secret-cipher.adapter';

import {
  PrismaMfaPersistence,
  type MfaCredentialRecord,
} from './prisma-mfa.persistence';

import { RedisMfaChallengeStore } from './redis-mfa-challenge.store';

import { TotpAdapter } from './totp.adapter';

@Injectable()
export class MfaAdapter implements MfaPort {
  private readonly config: AuthConfig;

  constructor(
    configService: ConfigService,

    private readonly challenges: RedisMfaChallengeStore,

    private readonly persistence: PrismaMfaPersistence,

    private readonly cipher: MfaSecretCipherAdapter,

    private readonly totp: TotpAdapter,

    @Inject(LOGIN_PERSISTENCE_PORT)
    private readonly loginPersistence: LoginPersistencePort,

    @Inject(AUTH_TOKEN_ISSUER_PORT)
    private readonly tokenIssuer: AuthTokenIssuerPort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,

    @Inject(ID_GENERATOR_PORT)
    private readonly idGenerator: IdGeneratorPort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  /*
   * =========================
   * PRE-AUTH LOGIN MFA
   * =========================
   */

  async beginPreAuthEnrollment(
    ticket: string,
  ): Promise<MfaEnrollmentResultDto> {
    const challenge = await this.challenges.read(ticket);

    if (challenge.mode !== 'enroll') {
      throw new InvalidMfaTicketException();
    }

    const account = await this.requireLoginAccount(challenge.userId);

    if (account.mfaEnabled) {
      throw new ResourceConflictException({
        code: 'AUTH_MFA_ALREADY_ENABLED',

        message: 'MFA đã được bật cho tài khoản này',

        resource: 'MFA credential',
      });
    }

    let secret: string;

    if (challenge.pendingSecret) {
      secret = this.cipher.decrypt(challenge.pendingSecret);
    } else {
      const generated = this.totp.generateSecret();

      const stored = await this.challenges.savePendingSecret(
        ticket,

        this.cipher.encrypt(generated),
      );

      secret = this.cipher.decrypt(stored);
    }

    return {
      secret,

      otpAuthUri: this.totp.buildOtpAuthUri(
        secret,

        account.email,
      ),

      expiresAt: new Date(challenge.expiresAt),
    };
  }

  async confirmPreAuthEnrollment(
    ticket: string,

    totpCode: string,

    clientOverride: LoginClientContext,
  ): Promise<MfaAuthenticatedResultDto> {
    const challenge = await this.challenges.read(ticket);

    if (challenge.mode !== 'enroll' || !challenge.pendingSecret) {
      throw new InvalidMfaTicketException();
    }

    const secret = this.cipher.decrypt(challenge.pendingSecret);

    const step = this.totp.verify(
      totpCode,

      secret,
    );

    if (step === null) {
      const remaining = await this.challenges.recordFailure(ticket);

      throw new InvalidMfaCodeException(remaining);
    }

    const consumed = await this.challenges.consume(ticket);

    const account = await this.requireLoginAccount(consumed.userId);

    if (account.mfaEnabled) {
      throw new ResourceConflictException({
        code: 'AUTH_MFA_ALREADY_ENABLED',

        message: 'MFA đã được bật cho tài khoản này',

        resource: 'MFA credential',
      });
    }

    const recoveryCodes = this.totp.generateRecoveryCodes();

    const now = new Date();

    const client = mergeClient(
      consumed.client,

      clientOverride,
    );

    await this.persistence.enableFromPreAuth(
      account.id,

      this.cipher.encrypt(secret),

      step,

      recoveryCodes,

      now,

      client,
    );

    const result = await this.createSession(
      account,

      client,

      now,

      consumed.source,
    );

    return {
      ...result,

      recoveryCodes,
    };
  }

  async verifyPreAuth(
    ticket: string,

    input: {
      totpCode?: string;

      recoveryCode?: string;
    },

    clientOverride: LoginClientContext,
  ): Promise<MfaAuthenticatedResultDto> {
    const challenge = await this.challenges.read(ticket);

    if (challenge.mode !== 'verify') {
      throw new InvalidMfaTicketException();
    }

    const account = await this.requireLoginAccount(challenge.userId);

    const credential = await this.persistence.findCredential(account.id);

    if (!credential) {
      throw new InvalidMfaTicketException();
    }

    const valid = await this.verifyCredential(
      credential,

      input,
    );

    if (!valid) {
      const remaining = await this.challenges.recordFailure(ticket);

      throw new InvalidMfaCodeException(remaining);
    }

    const consumed = await this.challenges.consume(ticket);

    return this.createSession(
      account,

      mergeClient(
        consumed.client,

        clientOverride,
      ),

      new Date(),

      consumed.source,
    );
  }

  /*
   * =========================
   * AUTHENTICATED SETTINGS
   * =========================
   */

  async getStatus(userId: string | undefined): Promise<MfaStatusDto> {
    const normalizedUserId = this.requireUserId(userId);

    const status = await this.persistence.getStatus(normalizedUserId);

    if (!status) {
      throw this.authenticationRequired();
    }

    return status;
  }

  async beginSettingsEnrollment(
    userId: string | undefined,

    currentPassword: string,
  ): Promise<MfaSettingsEnrollmentResultDto> {
    const normalizedUserId = this.requireUserId(userId);

    const account = await this.requirePasswordVerifiedAccount(
      normalizedUserId,

      currentPassword,
    );

    if (account.mfaEnabled) {
      throw new ResourceConflictException({
        code: 'AUTH_MFA_ALREADY_ENABLED',

        message: 'MFA đã được bật cho tài khoản',

        resource: 'MFA credential',
      });
    }

    const secret = this.totp.generateSecret();

    const expiresAt = new Date(
      Date.now() + this.config.adminMfa.preAuthTicketTtlSeconds * 1000,
    );

    const enrollmentId = await this.persistence.startEnrollment(
      normalizedUserId,

      this.cipher.encrypt(secret),

      expiresAt,
    );

    return {
      enrollmentId,

      secret,

      otpAuthUri: this.totp.buildOtpAuthUri(
        secret,

        account.email,
      ),

      expiresAt,
    };
  }

  async confirmSettingsEnrollment(
    userId: string | undefined,

    currentSessionId: string | undefined,

    enrollmentId: string,

    totpCode: string,

    deviceName: string | undefined,

    client: LoginClientContext,
  ): Promise<MfaSettingsConfirmationResultDto> {
    const normalizedUserId = this.requireUserId(userId);

    const normalizedSessionId = this.requireSessionId(currentSessionId);

    if (!isUuidV4(enrollmentId)) {
      throw this.invalidEnrollment();
    }

    const enrollment = await this.persistence.findPendingEnrollment(
      normalizedUserId,

      enrollmentId,
    );

    if (!enrollment || enrollment.expiresAt <= new Date()) {
      throw this.invalidEnrollment();
    }

    const secret = this.cipher.decrypt(enrollment.encryptedSecret);

    const step = this.totp.verify(
      totpCode,

      secret,
    );

    if (step === null) {
      throw new InvalidMfaCodeException();
    }

    const recoveryCodes = this.totp.generateRecoveryCodes();

    const enabledAt = new Date();

    const enabled = await this.persistence.enablePendingEnrollment(
      normalizedUserId,

      normalizedSessionId,

      enrollmentId,

      step,

      recoveryCodes,

      enabledAt,

      deviceName,

      client,
    );

    if (!enabled) {
      throw this.invalidEnrollment();
    }

    return {
      status: {
        enabled: true,

        configuredAt: enabledAt,

        recoveryCodesRemaining: recoveryCodes.length,
      },

      recoveryCodes,
    };
  }

  async disable(
    userId: string | undefined,

    currentSessionId: string | undefined,

    currentPassword: string,

    totpCode: string,

    client: LoginClientContext,
  ): Promise<MfaStatusDto> {
    const normalizedUserId = this.requireUserId(userId);

    const normalizedSessionId = this.requireSessionId(currentSessionId);

    const account = await this.requirePasswordVerifiedAccount(
      normalizedUserId,

      currentPassword,
    );

    /*
     * ADMIN policy.
     *
     * ADMIN không được tự tắt MFA khi
     * AUTH_ADMIN_MFA_ENABLED=true.
     */
    if (
      account.roles.includes(RoleCode.ADMIN) &&
      this.challenges.isAdminMfaRequired()
    ) {
      throw new AccessDeniedException({
        code: 'AUTH_MFA_REQUIRED_BY_POLICY',

        message: 'Tài khoản quản trị viên bắt buộc phải sử dụng MFA',
      });
    }

    const credential = await this.persistence.findCredential(normalizedUserId);

    if (!credential) {
      return {
        enabled: false,

        configuredAt: null,

        recoveryCodesRemaining: 0,
      };
    }

    const valid = await this.verifyCredential(
      credential,

      {
        totpCode,
      },
    );

    if (!valid) {
      throw new InvalidMfaCodeException();
    }

    await this.persistence.disableCredential(
      normalizedUserId,

      credential,

      new Date(),

      normalizedSessionId,

      client,
    );

    return {
      enabled: false,

      configuredAt: null,

      recoveryCodesRemaining: 0,
    };
  }

  async regenerateRecoveryCodes(
    userId: string | undefined,

    currentSessionId: string | undefined,

    currentPassword: string,

    totpCode: string,

    client: LoginClientContext,
  ): Promise<MfaRecoveryCodesResultDto> {
    const normalizedUserId = this.requireUserId(userId);

    const normalizedSessionId = this.requireSessionId(currentSessionId);

    await this.requirePasswordVerifiedAccount(
      normalizedUserId,

      currentPassword,
    );

    const credential = await this.persistence.findCredential(normalizedUserId);

    if (!credential) {
      throw new ResourceConflictException({
        code: 'AUTH_MFA_NOT_ENABLED',

        message: 'MFA chưa được bật cho tài khoản',

        resource: 'MFA credential',
      });
    }

    const valid = await this.verifyCredential(
      credential,

      {
        totpCode,
      },
    );

    if (!valid) {
      throw new InvalidMfaCodeException();
    }

    const recoveryCodes = this.totp.generateRecoveryCodes();

    const generatedAt = new Date();

    await this.persistence.replaceRecoveryCodes(
      normalizedUserId,

      credential,

      recoveryCodes,

      generatedAt,

      normalizedSessionId,

      client,
    );

    return {
      recoveryCodes,

      generatedAt,
    };
  }

  private async verifyCredential(
    credential: MfaCredentialRecord,

    input: {
      totpCode?: string;

      recoveryCode?: string;
    },
  ): Promise<boolean> {
    if (input.totpCode) {
      const secret = this.cipher.decrypt(credential.encryptedSecret);

      const step = this.totp.verify(
        input.totpCode,

        secret,
      );

      if (step === null) {
        return false;
      }

      if (credential.lastUsedStep !== null && step <= credential.lastUsedStep) {
        return false;
      }

      return this.persistence.consumeTotpStep(
        credential,

        step,
      );
    }

    if (input.recoveryCode) {
      return this.persistence.consumeRecoveryCode(
        credential,

        input.recoveryCode,
      );
    }

    return false;
  }

  private async requireLoginAccount(
    userId: string,
  ): Promise<LoginAccountRecord> {
    const account = await this.persistence.findAccount(userId);

    if (!account) {
      throw new InvalidMfaTicketException();
    }

    AccountLoginPolicy.assertCanLogin({
      status: account.status,

      deletedAt: account.deletedAt,

      emailVerifiedAt: account.emailVerifiedAt,
    });

    return account;
  }

  private async requirePasswordVerifiedAccount(
    userId: string,

    rawPassword: string,
  ): Promise<LoginAccountRecord> {
    const account = await this.persistence.findAccount(userId);

    if (!account) {
      throw this.authenticationRequired();
    }

    AccountLoginPolicy.assertCanLogin({
      status: account.status,

      deletedAt: account.deletedAt,

      emailVerifiedAt: account.emailVerifiedAt,
    });

    if (!account.passwordHash) {
      throw new AccessDeniedException({
        code: 'AUTH_MFA_PASSWORD_REQUIRED',

        message: 'Tài khoản cần có mật khẩu trước khi cấu hình MFA',
      });
    }

    const password = CurrentPasswordValueObject.create(rawPassword);

    const matches = await this.passwordHasher.verify(
      password.value,

      account.passwordHash,
    );

    if (!matches) {
      throw new InvalidCurrentPasswordException();
    }

    return account;
  }

  private async createSession(
    account: LoginAccountRecord,

    client: LoginClientContext,

    mfaVerifiedAt: Date,

    authenticationMethod: 'password' | 'google' | 'github',
  ): Promise<LoginResultDto> {
    const sessionId = this.idGenerator.generate();

    const refreshTokenFamilyId = this.idGenerator.generate();

    const tokens = this.tokenIssuer.issue({
      userId: account.id,

      sessionId,

      refreshTokenFamilyId,

      accessTokenVersion: 0,

      refreshTokenVersion: 0,
    });

    await this.loginPersistence.createSession({
      id: sessionId,

      userId: account.id,

      refreshTokenHash: this.secureToken.hash(tokens.refreshToken),

      refreshTokenFamilyId,

      refreshTokenVersion: 0,

      accessTokenVersion: 0,

      mfaVerifiedAt,

      authenticationMethod,

      deviceId: client.deviceId,

      deviceName: client.deviceName,

      ipAddress: client.ipAddress,

      userAgent: client.userAgent,

      loggedInAt: mfaVerifiedAt,

      expiresAt: tokens.refreshTokenExpiresAt,
    });

    return LoginResultMapper.toDto(
      account,

      sessionId,

      tokens,
    );
  }

  private requireUserId(value: string | undefined): string {
    if (!value || !isUuidV4(value)) {
      throw this.authenticationRequired();
    }

    return value;
  }

  private requireSessionId(value: string | undefined): string {
    if (!value || !isUuidV4(value)) {
      throw this.authenticationRequired();
    }

    return value;
  }

  private authenticationRequired(): AuthenticationRequiredException {
    return new AuthenticationRequiredException({
      code: 'AUTH_CURRENT_SESSION_REQUIRED',

      message: 'Phiên đăng nhập hiện tại không hợp lệ',
    });
  }

  private invalidEnrollment(): InvalidTokenException {
    return new InvalidTokenException({
      code: 'AUTH_MFA_ENROLLMENT_INVALID',

      message: 'Phiên thiết lập MFA không hợp lệ hoặc đã hết hạn',
    });
  }
}

function mergeClient(
  original: LoginClientContext,

  override: LoginClientContext,
): LoginClientContext {
  return {
    ipAddress: override.ipAddress ?? original.ipAddress,

    userAgent: override.userAgent ?? original.userAgent,

    deviceId: override.deviceId ?? original.deviceId,

    deviceName: override.deviceName ?? original.deviceName,
  };
}
