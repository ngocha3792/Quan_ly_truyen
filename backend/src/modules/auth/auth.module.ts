import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import {
  generateSecureToken,
  generateUuid,
  hashPassword,
  sha256,
  timingSafeEqualStrings,
  verifyPassword,
} from '@/common/utils';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';
import { OutboxCoreModule } from '@/infrastructure/queue/outbox/outbox-core.module';

import {
  CURRENT_USER_READER_PORT,
  GetCurrentUserQueryHandler,
  GetSessionsQueryHandler,
  SESSION_MANAGEMENT_PERSISTENCE_PORT,
  RevokeSessionCommandHandler,
  ForgotPasswordCommandHandler,
  PASSWORD_RESET_COOLDOWN_PORT,
  PASSWORD_RESET_PERSISTENCE_PORT,
  ResetPasswordCommandHandler,
  EMAIL_VERIFICATION_COOLDOWN_PORT,
  RESEND_EMAIL_VERIFICATION_PERSISTENCE_PORT,
  ResendEmailVerificationCommandHandler,
  EMAIL_VERIFICATION_PERSISTENCE_PORT,
  VerifyEmailCommandHandler,
  ACCESS_SESSION_READER_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
  JWT_BLACKLIST_PORT,
  LOGIN_PERSISTENCE_PORT,
  LOGIN_RATE_LIMITER_PORT,
  LoginCommandHandler,
  LogoutAllCommandHandler,
  LogoutCommandHandler,
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
  REFRESH_SESSION_PERSISTENCE_PORT,
  REFRESH_TOKEN_VERIFIER_PORT,
  RefreshTokenCommandHandler,
  RegisterCommandHandler,
  REGISTRATION_UNIT_OF_WORK_PORT,
  RevokeAccessTokenCommandHandler,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
  ValidateAccessTokenQueryHandler,
} from './application';
import {
  PrismaCurrentUserReader,
  PrismaSessionManagementPersistence,
  JwtAccessStrategy,
  JwtAuthTokenIssuer,
  JwtRefreshTokenVerifier,
  PrismaEmailVerificationPersistence,
  PrismaAccessSessionReader,
  PrismaLoginPersistence,
  PrismaRefreshSessionPersistence,
  PrismaRegistrationUnitOfWork,
  RedisJwtBlacklist,
  PasswordResetUrlBuilder,
  PrismaPasswordResetPersistence,
  RedisPasswordResetCooldown,
  EmailVerificationUrlBuilder,
  PrismaResendEmailVerificationPersistence,
  RedisEmailVerificationCooldown,
  RedisLoginRateLimiter,
} from './infrastructure';
import { AuthController } from './presentation/http';

const passwordHasherProvider = {
  provide: PASSWORD_HASHER_PORT,

  useValue: {
    hash: (plainPassword: string): Promise<string> =>
      hashPassword(plainPassword),

    verify: (plainPassword: string, passwordHash: string): Promise<boolean> =>
      verifyPassword(plainPassword, passwordHash),
  } satisfies PasswordHasherPort,
};

const secureTokenProvider = {
  provide: SECURE_TOKEN_PORT,

  useValue: {
    generate: (): string => generateSecureToken(),

    hash: (token: string): string => sha256(token),

    equalsHash: (leftHash: string, rightHash: string): boolean =>
      timingSafeEqualStrings(leftHash, rightHash),
  } satisfies SecureTokenPort,
};

const idGeneratorProvider = {
  provide: ID_GENERATOR_PORT,

  useValue: {
    generate: (): string => generateUuid(),
  } satisfies IdGeneratorPort,
};

@Module({
  imports: [
    PassportModule.register({
      session: false,
    }),

    RedisModule,
    PrismaModule,
    OutboxCoreModule,
  ],

  controllers: [AuthController],

  providers: [
    RevokeSessionCommandHandler,
    GetCurrentUserQueryHandler,
    GetSessionsQueryHandler,
    RegisterCommandHandler,
    LoginCommandHandler,
    LogoutCommandHandler,
    LogoutAllCommandHandler,
    RefreshTokenCommandHandler,
    ResendEmailVerificationCommandHandler,
    ForgotPasswordCommandHandler,
    ResetPasswordCommandHandler,
    RevokeAccessTokenCommandHandler,
    VerifyEmailCommandHandler,
    ValidateAccessTokenQueryHandler,

    PrismaRegistrationUnitOfWork,
    PrismaEmailVerificationPersistence,
    PrismaResendEmailVerificationPersistence,
    PrismaPasswordResetPersistence,
    PrismaLoginPersistence,
    PrismaRefreshSessionPersistence,
    PrismaAccessSessionReader,
    PrismaSessionManagementPersistence,
    PrismaCurrentUserReader,

    RedisEmailVerificationCooldown,
    RedisPasswordResetCooldown,
    RedisLoginRateLimiter,
    RedisJwtBlacklist,

    EmailVerificationUrlBuilder,
    PasswordResetUrlBuilder,

    JwtAuthTokenIssuer,
    JwtRefreshTokenVerifier,
    JwtAccessStrategy,
    {
      provide: EMAIL_VERIFICATION_PERSISTENCE_PORT,

      useExisting: PrismaEmailVerificationPersistence,
    },
    {
      provide: EMAIL_VERIFICATION_COOLDOWN_PORT,

      useExisting: RedisEmailVerificationCooldown,
    },
    {
      provide: CURRENT_USER_READER_PORT,

      useExisting: PrismaCurrentUserReader,
    },

    {
      provide: SESSION_MANAGEMENT_PERSISTENCE_PORT,

      useExisting: PrismaSessionManagementPersistence,
    },

    {
      provide: RESEND_EMAIL_VERIFICATION_PERSISTENCE_PORT,

      useExisting: PrismaResendEmailVerificationPersistence,
    },

    {
      provide: REGISTRATION_UNIT_OF_WORK_PORT,

      useExisting: PrismaRegistrationUnitOfWork,
    },
    {
      provide: PASSWORD_RESET_COOLDOWN_PORT,

      useExisting: RedisPasswordResetCooldown,
    },

    {
      provide: PASSWORD_RESET_PERSISTENCE_PORT,

      useExisting: PrismaPasswordResetPersistence,
    },

    {
      provide: LOGIN_PERSISTENCE_PORT,

      useExisting: PrismaLoginPersistence,
    },

    {
      provide: REFRESH_SESSION_PERSISTENCE_PORT,

      useExisting: PrismaRefreshSessionPersistence,
    },

    {
      provide: ACCESS_SESSION_READER_PORT,

      useExisting: PrismaAccessSessionReader,
    },

    {
      provide: AUTH_TOKEN_ISSUER_PORT,

      useExisting: JwtAuthTokenIssuer,
    },

    {
      provide: REFRESH_TOKEN_VERIFIER_PORT,

      useExisting: JwtRefreshTokenVerifier,
    },

    {
      provide: LOGIN_RATE_LIMITER_PORT,

      useExisting: RedisLoginRateLimiter,
    },

    {
      provide: JWT_BLACKLIST_PORT,

      useExisting: RedisJwtBlacklist,
    },

    passwordHasherProvider,
    secureTokenProvider,
    idGeneratorProvider,
  ],

  exports: [PassportModule, ValidateAccessTokenQueryHandler],
})
export class AuthModule {}
