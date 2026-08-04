import { Inject, Injectable } from '@nestjs/common';

import { RoleCode } from '@/common/enums';
import {
  AccessDeniedException,
  ResourceConflictException,
} from '@/common/exceptions';

import type { LoginResultDto } from '../../application/dto';
import type { LoginAccountRecord } from '../../application/ports';
import { LoginResultMapper } from '../../application/mappers';
import {
  AUTH_TOKEN_ISSUER_PORT,
  type AuthTokenIssuerPort,
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
  LOGIN_PERSISTENCE_PORT,
  type LoginPersistencePort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../application/ports';
import type { LoginClientContext } from '../../application/commands/login/login.command';
import {
  InvalidMfaCodeException,
  InvalidMfaTicketException,
} from '../../domain/exceptions';
import { AccountLoginPolicy } from '../../domain/policies';

import { MfaSecretCipherService } from './mfa-secret-cipher.service';
import { PrismaAdminMfaPersistence } from './prisma-admin-mfa.persistence';
import { RedisAdminMfaChallengeStore } from './redis-admin-mfa-challenge.store';
import { TotpService } from './totp.service';

export interface MfaEnrollmentResult {
  secret: string;
  otpAuthUri: string;
  expiresAt: Date;
}

export interface MfaAuthenticatedResult extends LoginResultDto {
  recoveryCodes?: readonly string[];
}

@Injectable()
export class AdminMfaService {
  constructor(
    private readonly challenges: RedisAdminMfaChallengeStore,
    private readonly persistence: PrismaAdminMfaPersistence,
    private readonly cipher: MfaSecretCipherService,
    private readonly totp: TotpService,
    @Inject(LOGIN_PERSISTENCE_PORT)
    private readonly loginPersistence: LoginPersistencePort,
    @Inject(AUTH_TOKEN_ISSUER_PORT)
    private readonly tokenIssuer: AuthTokenIssuerPort,
    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
    @Inject(ID_GENERATOR_PORT)
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async beginEnrollment(ticket: string): Promise<MfaEnrollmentResult> {
    const challenge = await this.challenges.read(ticket);
    if (challenge.mode !== 'enroll') {
      throw new InvalidMfaTicketException();
    }
    const account = await this.requireAdminAccount(challenge.userId);
    if (account.mfaEnabled) {
      throw new ResourceConflictException({
        code: 'AUTH_MFA_ALREADY_ENABLED',
        message: 'MFA đã được bật cho tài khoản quản trị viên',
        resource: 'MFA credential',
      });
    }

    let secret: string;
    if (challenge.pendingSecret) {
      secret = this.cipher.decrypt(challenge.pendingSecret);
    } else {
      secret = this.totp.generateSecret();
      const stored = await this.challenges.savePendingSecret(
        ticket,
        this.cipher.encrypt(secret),
      );
      secret = this.cipher.decrypt(stored);
    }

    return {
      secret,
      otpAuthUri: this.totp.buildOtpAuthUri(secret, account.email),
      expiresAt: new Date(challenge.expiresAt),
    };
  }

  async confirmEnrollment(
    ticket: string,
    totpCode: string,
    clientOverride: LoginClientContext,
  ): Promise<MfaAuthenticatedResult> {
    const challenge = await this.challenges.read(ticket);
    if (challenge.mode !== 'enroll' || !challenge.pendingSecret) {
      throw new InvalidMfaTicketException();
    }
    const secret = this.cipher.decrypt(challenge.pendingSecret);
    const step = this.totp.verify(totpCode, secret);
    if (step === null) {
      const remaining = await this.challenges.recordFailure(ticket);
      throw new InvalidMfaCodeException(remaining);
    }

    const consumed = await this.challenges.consume(ticket);
    const account = await this.requireAdminAccount(consumed.userId);
    if (account.mfaEnabled) {
      throw new ResourceConflictException({
        code: 'AUTH_MFA_ALREADY_ENABLED',
        message: 'MFA đã được bật cho tài khoản quản trị viên',
        resource: 'MFA credential',
      });
    }

    const recoveryCodes = this.totp.generateRecoveryCodes();
    const now = new Date();
    const client = mergeClient(consumed.client, clientOverride);
    await this.persistence.enable(
      account.id,
      this.cipher.encrypt(secret),
      recoveryCodes,
      step,
      now,
      client,
    );

    const result = await this.createSession(
      account,
      client,
      now,
      consumed.source,
    );
    return { ...result, recoveryCodes };
  }

  async verify(
    ticket: string,
    input: { totpCode?: string; recoveryCode?: string },
    clientOverride: LoginClientContext,
  ): Promise<MfaAuthenticatedResult> {
    const challenge = await this.challenges.read(ticket);
    if (challenge.mode !== 'verify') {
      throw new InvalidMfaTicketException();
    }
    const account = await this.requireAdminAccount(challenge.userId);
    const credential = await this.persistence.findCredential(account.id);
    if (!credential) {
      throw new InvalidMfaTicketException();
    }

    let valid = false;
    if (input.totpCode) {
      const secret = this.cipher.decrypt(credential.encryptedSecret);
      const step = this.totp.verify(input.totpCode, secret);
      valid =
        step !== null &&
        (credential.lastUsedStep === null || step > credential.lastUsedStep) &&
        (await this.persistence.consumeTotpStep(account.id, step));
    } else if (input.recoveryCode) {
      valid = await this.persistence.consumeRecoveryCode(
        account.id,
        input.recoveryCode,
      );
    }

    if (!valid) {
      const remaining = await this.challenges.recordFailure(ticket);
      throw new InvalidMfaCodeException(remaining);
    }

    const consumed = await this.challenges.consume(ticket);
    return this.createSession(
      account,
      mergeClient(consumed.client, clientOverride),
      new Date(),
      consumed.source,
    );
  }

  private async requireAdminAccount(userId: string) {
    const account = await this.persistence.findAccount(userId);
    if (!account || !account.roles.includes(RoleCode.ADMIN)) {
      throw new AccessDeniedException({
        code: 'AUTH_ADMIN_MFA_FORBIDDEN',
        message: 'MFA quản trị viên không khả dụng cho tài khoản này',
      });
    }
    AccountLoginPolicy.assertCanLogin({
      status: account.status,
      deletedAt: account.deletedAt,
      emailVerifiedAt: account.emailVerifiedAt,
    });
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
    const accessTokenVersion = 0;
    const refreshTokenVersion = 0;
    const tokens = this.tokenIssuer.issue({
      userId: account.id,
      sessionId,
      refreshTokenFamilyId,
      accessTokenVersion,
      refreshTokenVersion,
    });
    await this.loginPersistence.createSession({
      id: sessionId,
      userId: account.id,
      refreshTokenHash: this.secureToken.hash(tokens.refreshToken),
      refreshTokenFamilyId,
      refreshTokenVersion,
      accessTokenVersion,
      mfaVerifiedAt,
      authenticationMethod,
      deviceId: client.deviceId,
      deviceName: client.deviceName,
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
      loggedInAt: mfaVerifiedAt,
      expiresAt: tokens.refreshTokenExpiresAt,
    });
    return LoginResultMapper.toDto(account, sessionId, tokens);
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
