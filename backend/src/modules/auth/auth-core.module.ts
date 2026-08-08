import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import {
  ACCESS_SESSION_READER_PORT,
  ACCOUNT_DELETION_PERSISTENCE_PORT,
  AUTH_AUDIT_READER_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  CHANGE_PASSWORD_PERSISTENCE_PORT,
  CURRENT_USER_READER_PORT,
  EMAIL_CHANGE_PERSISTENCE_PORT,
  EMAIL_VERIFICATION_COOLDOWN_PORT,
  EMAIL_VERIFICATION_PERSISTENCE_PORT,
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
  JWT_BLACKLIST_PORT,
  LOGIN_PERSISTENCE_PORT,
  LOGIN_RATE_LIMITER_PORT,
  MFA_CHALLENGE_PORT,
  PASSWORD_HASHER_PORT,
  PASSWORD_RESET_COOLDOWN_PORT,
  PASSWORD_RESET_PERSISTENCE_PORT,
  RECOVERY_EMAIL_PERSISTENCE_PORT,
  REFRESH_SESSION_PERSISTENCE_PORT,
  REFRESH_TOKEN_VERIFIER_PORT,
  REGISTRATION_UNIT_OF_WORK_PORT,
  RESEND_EMAIL_VERIFICATION_PERSISTENCE_PORT,
  SECURE_TOKEN_PORT,
  SECURITY_OVERVIEW_READER_PORT,
  SECURITY_QUESTIONS_PERSISTENCE_PORT,
  SESSION_MANAGEMENT_PERSISTENCE_PORT,
  type PasswordHasherPort,
  type SecureTokenPort,
  ValidateAccessTokenQueryHandler,
} from './application';
import {
  AuthAuditWriterService,
  ChangeEmailUrlBuilder,
  CsrfTokenService,
  EmailVerificationUrlBuilder,
  JwtAccessStrategy,
  JwtAuthTokenIssuer,
  JwtRefreshTokenVerifier,
  MfaSecretCipherService,
  MfaService,
  OAuthFlowService,
  OAuthHandoffStore,
  PasswordResetUrlBuilder,
  PrismaAccessSessionReader,
  PrismaAccountDeletionPersistence,
  PrismaAuthAuditReader,
  PrismaChangePasswordPersistence,
  PrismaCurrentUserReader,
  PrismaEmailChangePersistence,
  PrismaEmailVerificationPersistence,
  PrismaLoginPersistence,
  PrismaMfaPersistence,
  PrismaPasswordResetPersistence,
  PrismaRecoveryEmailPersistence,
  PrismaRefreshSessionPersistence,
  PrismaRegistrationUnitOfWork,
  PrismaResendEmailVerificationPersistence,
  PrismaSecurityOverviewReader,
  PrismaSecurityQuestionsPersistence,
  PrismaSessionManagementPersistence,
  RedisEmailVerificationCooldown,
  RedisJwtBlacklist,
  RedisLoginRateLimiter,
  RedisMfaChallengeStore,
  RedisPasswordResetCooldown,
  TotpService,
} from './infrastructure';
import { AuthCookieService } from './presentation/http';

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

const portProviders = [
  { provide: MFA_CHALLENGE_PORT, useExisting: RedisMfaChallengeStore },
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
  { provide: AUTH_AUDIT_READER_PORT, useExisting: PrismaAuthAuditReader },
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
  { provide: CURRENT_USER_READER_PORT, useExisting: PrismaCurrentUserReader },
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
  { provide: LOGIN_PERSISTENCE_PORT, useExisting: PrismaLoginPersistence },
  {
    provide: REFRESH_SESSION_PERSISTENCE_PORT,
    useExisting: PrismaRefreshSessionPersistence,
  },
  {
    provide: ACCESS_SESSION_READER_PORT,
    useExisting: PrismaAccessSessionReader,
  },
  { provide: AUTH_TOKEN_ISSUER_PORT, useExisting: JwtAuthTokenIssuer },
  {
    provide: REFRESH_TOKEN_VERIFIER_PORT,
    useExisting: JwtRefreshTokenVerifier,
  },
  { provide: LOGIN_RATE_LIMITER_PORT, useExisting: RedisLoginRateLimiter },
  { provide: JWT_BLACKLIST_PORT, useExisting: RedisJwtBlacklist },
  passwordHasherProvider,
  secureTokenProvider,
  idGeneratorProvider,
];

const portTokens = [
  MFA_CHALLENGE_PORT,
  RECOVERY_EMAIL_PERSISTENCE_PORT,
  CHANGE_PASSWORD_PERSISTENCE_PORT,
  ACCOUNT_DELETION_PERSISTENCE_PORT,
  EMAIL_VERIFICATION_PERSISTENCE_PORT,
  AUTH_AUDIT_READER_PORT,
  SECURITY_OVERVIEW_READER_PORT,
  EMAIL_CHANGE_PERSISTENCE_PORT,
  EMAIL_VERIFICATION_COOLDOWN_PORT,
  SECURITY_QUESTIONS_PERSISTENCE_PORT,
  CURRENT_USER_READER_PORT,
  SESSION_MANAGEMENT_PERSISTENCE_PORT,
  RESEND_EMAIL_VERIFICATION_PERSISTENCE_PORT,
  REGISTRATION_UNIT_OF_WORK_PORT,
  PASSWORD_RESET_COOLDOWN_PORT,
  PASSWORD_RESET_PERSISTENCE_PORT,
  LOGIN_PERSISTENCE_PORT,
  REFRESH_SESSION_PERSISTENCE_PORT,
  ACCESS_SESSION_READER_PORT,
  AUTH_TOKEN_ISSUER_PORT,
  REFRESH_TOKEN_VERIFIER_PORT,
  LOGIN_RATE_LIMITER_PORT,
  JWT_BLACKLIST_PORT,
  PASSWORD_HASHER_PORT,
  SECURE_TOKEN_PORT,
  ID_GENERATOR_PORT,
];

@Module({
  imports: [
    PassportModule.register({ session: false }),
    AuthAuthorizationModule,
    RedisModule,
    PrismaModule,
    OutboxCoreModule,
  ],
  providers: [
    CsrfTokenService,
    AuthCookieService,
    AuthAuditWriterService,
    RedisMfaChallengeStore,
    PrismaMfaPersistence,
    MfaSecretCipherService,
    TotpService,
    MfaService,
    OAuthFlowService,
    OAuthHandoffStore,
    PrismaRecoveryEmailPersistence,
    PrismaAuthAuditReader,
    PrismaSecurityOverviewReader,
    PrismaSecurityQuestionsPersistence,
    PrismaEmailChangePersistence,
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
    ChangeEmailUrlBuilder,
    JwtAuthTokenIssuer,
    JwtRefreshTokenVerifier,
    ValidateAccessTokenQueryHandler,
    JwtAccessStrategy,
    ...portProviders,
  ],
  exports: [
    PassportModule,
    CsrfTokenService,
    AuthCookieService,
    MfaService,
    OAuthFlowService,
    OAuthHandoffStore,
    ValidateAccessTokenQueryHandler,
    ...portTokens,
  ],
})
export class AuthCoreModule {}
