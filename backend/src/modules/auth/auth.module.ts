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

import { AuthAuthorizationModule } from './auth-authorization.module';

import {
  RECOVERY_EMAIL_PERSISTENCE_PORT,
  GetRecoveryEmailStatusQueryHandler,
  RequestRecoveryEmailCommandHandler,
  VerifyRecoveryEmailCommandHandler,
  ResendRecoveryEmailCommandHandler,
  RemoveRecoveryEmailCommandHandler,
  SECURITY_OVERVIEW_READER_PORT,
  GetSecurityOverviewQueryHandler,
  ACCOUNT_DELETION_PERSISTENCE_PORT,
  DeleteAccountCommandHandler,
  MFA_CHALLENGE_PORT,
  AUTH_AUDIT_READER_PORT,
  GetSecurityEventsQueryHandler,
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
  SECURITY_QUESTIONS_PERSISTENCE_PORT,
  GetSecurityQuestionCatalogQueryHandler,
  GetSecurityQuestionsQueryHandler,
  UpdateSecurityQuestionsCommandHandler,
  RemoveSecurityQuestionsCommandHandler,
  LogoutAllCommandHandler,
  LogoutCommandHandler,
  PASSWORD_HASHER_PORT,
  EMAIL_CHANGE_PERSISTENCE_PORT,
  RequestEmailChangeCommandHandler,
  ConfirmEmailChangeCommandHandler,
  type PasswordHasherPort,
  REFRESH_SESSION_PERSISTENCE_PORT,
  REFRESH_TOKEN_VERIFIER_PORT,
  RefreshTokenCommandHandler,
  RegisterCommandHandler,
  REGISTRATION_UNIT_OF_WORK_PORT,
  RevokeAccessTokenCommandHandler,
  CHANGE_PASSWORD_PERSISTENCE_PORT,
  ChangePasswordCommandHandler,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
  ValidateAccessTokenQueryHandler,
  ValidatePasswordResetTokenQueryHandler,
} from './application';
import {
  PrismaSecurityOverviewReader,
  CsrfTokenService,
  PrismaCurrentUserReader,
  PrismaSessionManagementPersistence,
  JwtAccessStrategy,
  JwtAuthTokenIssuer,
  JwtRefreshTokenVerifier,
  PrismaEmailVerificationPersistence,
  PrismaRecoveryEmailPersistence,
  PrismaAccessSessionReader,
  PrismaLoginPersistence,
  PrismaRefreshSessionPersistence,
  PrismaRegistrationUnitOfWork,
  ChangeEmailUrlBuilder,
  AuthAuditWriterService,
  PrismaAuthAuditReader,
  PrismaSecurityQuestionsPersistence,
  PrismaEmailChangePersistence,
  RedisJwtBlacklist,
  PasswordResetUrlBuilder,
  PrismaPasswordResetPersistence,
  RedisPasswordResetCooldown,
  EmailVerificationUrlBuilder,
  PrismaResendEmailVerificationPersistence,
  RedisEmailVerificationCooldown,
  RedisLoginRateLimiter,
  PrismaChangePasswordPersistence,
  MfaSecretCipherService,
  PrismaAccountDeletionPersistence,
  TotpService,
  MfaService,
  PrismaMfaPersistence,
  RedisMfaChallengeStore,
  OAuthFlowService,
  OAuthHandoffStore,
} from './infrastructure';
import {
  MfaController,
  MfaSecurityController,
  OAuthController,
  SecurityQuestionsController,
  AuthAccountController,
  RecoveryEmailSecurityController,
  AuthCookieService,
  AuthCredentialsController,
  AuthTokenController,
  RefreshCookieCsrfGuard,
} from './presentation/http';
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

    AuthAuthorizationModule,

    RedisModule,
    PrismaModule,
    OutboxCoreModule,
  ],

  controllers: [
    AuthCredentialsController,

    AuthTokenController,
    RecoveryEmailSecurityController,
    SecurityQuestionsController,
    AuthAccountController,
    MfaController,
    MfaSecurityController,
    OAuthController,
  ],

  providers: [
    CsrfTokenService,
    AuthCookieService,

    DeleteAccountCommandHandler,
    GetSecurityQuestionCatalogQueryHandler,

    GetSecurityQuestionsQueryHandler,

    UpdateSecurityQuestionsCommandHandler,

    RemoveSecurityQuestionsCommandHandler,

    PrismaSecurityQuestionsPersistence,
    AuthAuditWriterService,
    RedisMfaChallengeStore,
    PrismaMfaPersistence,
    MfaSecretCipherService,
    TotpService,
    MfaService,
    OAuthFlowService,
    OAuthHandoffStore,
    GetRecoveryEmailStatusQueryHandler,

    RequestRecoveryEmailCommandHandler,

    VerifyRecoveryEmailCommandHandler,

    ResendRecoveryEmailCommandHandler,

    RemoveRecoveryEmailCommandHandler,

    PrismaRecoveryEmailPersistence,

    PrismaAuthAuditReader,

    GetSecurityEventsQueryHandler,
    ValidatePasswordResetTokenQueryHandler,
    GetSecurityOverviewQueryHandler,
    RefreshCookieCsrfGuard,
    RevokeSessionCommandHandler,
    GetCurrentUserQueryHandler,
    GetSessionsQueryHandler,
    RegisterCommandHandler,
    PrismaSecurityOverviewReader,
    LoginCommandHandler,
    LogoutCommandHandler,
    RequestEmailChangeCommandHandler,

    ConfirmEmailChangeCommandHandler,

    PrismaEmailChangePersistence,

    ChangeEmailUrlBuilder,
    ChangePasswordCommandHandler,
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
    PrismaAccountDeletionPersistence,
    PrismaSessionManagementPersistence,
    PrismaCurrentUserReader,

    PrismaChangePasswordPersistence,
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
      provide: MFA_CHALLENGE_PORT,

      useExisting: RedisMfaChallengeStore,
    },
    {
      provide: RECOVERY_EMAIL_PERSISTENCE_PORT,

      useExisting: PrismaRecoveryEmailPersistence,
    },
    {
      provide: CHANGE_PASSWORD_PERSISTENCE_PORT,

      useExisting: PrismaChangePasswordPersistence,
    },
    {
      provide: ACCOUNT_DELETION_PERSISTENCE_PORT,

      useExisting: PrismaAccountDeletionPersistence,
    },
    {
      provide: EMAIL_VERIFICATION_PERSISTENCE_PORT,

      useExisting: PrismaEmailVerificationPersistence,
    },
    {
      provide: AUTH_AUDIT_READER_PORT,

      useExisting: PrismaAuthAuditReader,
    },
    {
      provide: SECURITY_OVERVIEW_READER_PORT,

      useExisting: PrismaSecurityOverviewReader,
    },
    {
      provide: EMAIL_CHANGE_PERSISTENCE_PORT,

      useExisting: PrismaEmailChangePersistence,
    },
    {
      provide: EMAIL_VERIFICATION_COOLDOWN_PORT,

      useExisting: RedisEmailVerificationCooldown,
    },
    {
      provide: SECURITY_QUESTIONS_PERSISTENCE_PORT,

      useExisting: PrismaSecurityQuestionsPersistence,
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

  exports: [
    PassportModule,

    ValidateAccessTokenQueryHandler,

    AuthAuthorizationModule,
  ],
})
export class AuthModule {}
