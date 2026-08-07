import { Inject, Injectable } from '@nestjs/common';

import type { LoginResultDto } from '../../dto';
import { LoginResultMapper } from '../../mappers';
import {
  MFA_CHALLENGE_PORT,
  type MfaChallengePort,
  AUTH_TOKEN_ISSUER_PORT,
  type AuthTokenIssuerPort,
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
  LOGIN_PERSISTENCE_PORT,
  type LoginPersistencePort,
  LOGIN_RATE_LIMITER_PORT,
  type LoginRateLimiterPort,
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';
import {
  MfaRequiredException,
  InvalidLoginCredentialsException,
} from '../../../domain/exceptions';
import { RoleCode } from '@/common/enums';
import { AccountLoginPolicy } from '../../../domain/policies';
import {
  LoginIdentifierValueObject,
  LoginPasswordValueObject,
} from '../../../domain/value-objects';

import { LoginCommand } from './login.command';

const DUMMY_PASSWORD_HASH =
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxgY7x47H27Q5cbSQfH5eDP76eW';

@Injectable()
export class LoginCommandHandler {
  constructor(
    @Inject(LOGIN_PERSISTENCE_PORT)
    private readonly persistence: LoginPersistencePort,

    @Inject(LOGIN_RATE_LIMITER_PORT)
    private readonly rateLimiter: LoginRateLimiterPort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,

    @Inject(AUTH_TOKEN_ISSUER_PORT)
    private readonly tokenIssuer: AuthTokenIssuerPort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,

    @Inject(ID_GENERATOR_PORT)
    private readonly idGenerator: IdGeneratorPort,

    @Inject(MFA_CHALLENGE_PORT)
    private readonly mfaChallenge: MfaChallengePort,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResultDto> {
    const identifier = LoginIdentifierValueObject.create(command.identifier);

    const password = LoginPasswordValueObject.create(command.password);

    const rateLimitInput = {
      identifier: identifier.value,
      ipAddress: command.client.ipAddress,
    };

    /*
     * Chặn trước khi chạy bcrypt nếu key đã đạt giới hạn.
     */
    await this.rateLimiter.assertAllowed(rateLimitInput);

    const account = await this.persistence.findAccountByIdentifier(
      identifier.value,
    );

    /*
     * Luôn bcrypt compare kể cả account không tồn tại.
     */
    const hashForComparison = account?.passwordHash ?? DUMMY_PASSWORD_HASH;

    const passwordMatches = await this.passwordHasher.verify(
      password.value,
      hashForComparison,
    );

    if (!account || !account.passwordHash || !passwordMatches) {
      await this.rateLimiter.recordFailure(rateLimitInput);

      throw new InvalidLoginCredentialsException();
    }

    try {
      AccountLoginPolicy.assertCanLogin({
        status: account.status,
        deletedAt: account.deletedAt,
        emailVerifiedAt: account.emailVerifiedAt,
      });
    } catch (error: unknown) {
      /*
       * Tài khoản bị khóa nhưng password đúng vẫn phải
       * chịu rate limit để tránh request lặp vô hạn.
       */
      await this.rateLimiter.recordFailure(rateLimitInput);

      throw error;
    }

    /*
     * Redis phải reset thành công trước khi tạo session.
     * Nếu Redis lỗi, request fail và chưa có session mới.
     */
    await this.rateLimiter.resetAfterSuccess(rateLimitInput);

    const adminMfaRequired =
      account.roles.includes(RoleCode.ADMIN) &&
      this.mfaChallenge.isAdminMfaRequired();

    const mfaRequired = Boolean(account.mfaEnabled) || adminMfaRequired;

    if (mfaRequired) {
      const challenge = await this.mfaChallenge.create({
        userId: account.id,

        mode: account.mfaEnabled ? 'verify' : 'enroll',

        source: 'password',

        client: command.client,
      });

      throw new MfaRequiredException(challenge);
    }

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

    const loggedInAt = new Date();

    await this.persistence.createSession({
      id: sessionId,
      userId: account.id,

      refreshTokenHash: this.secureToken.hash(tokens.refreshToken),

      refreshTokenFamilyId,
      refreshTokenVersion,
      accessTokenVersion,
      authenticationMethod: 'password',

      deviceId: command.client.deviceId,
      deviceName: command.client.deviceName,
      ipAddress: command.client.ipAddress,
      userAgent: command.client.userAgent,

      loggedInAt,

      expiresAt: tokens.refreshTokenExpiresAt,
    });

    return LoginResultMapper.toDto(account, sessionId, tokens);
  }
}
