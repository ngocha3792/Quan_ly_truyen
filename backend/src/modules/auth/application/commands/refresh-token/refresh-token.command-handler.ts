import { Inject, Injectable } from '@nestjs/common';
import {
  AuthAccountStatus,
  SessionRevocationReason,
} from '../../../domain/enums';
import type { RefreshTokenResultDto } from '../../dto';
import { RefreshTokenResultMapper } from '../../mappers';
import {
  AUTH_TOKEN_ISSUER_PORT,
  type AuthTokenIssuerPort,
  REFRESH_SESSION_PERSISTENCE_PORT,
  type RefreshSessionPersistencePort,
  REFRESH_TOKEN_VERIFIER_PORT,
  type RefreshTokenVerifierPort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';
import {
  InvalidRefreshTokenException,
  RefreshTokenReuseDetectedException,
} from '../../../domain/exceptions';

import { RefreshTokenCommand } from './refresh-token.command';

const REFRESH_TOKEN_REUSE_REASON = 'refresh_token_reuse_detected';

@Injectable()
export class RefreshTokenCommandHandler {
  constructor(
    @Inject(REFRESH_TOKEN_VERIFIER_PORT)
    private readonly tokenVerifier: RefreshTokenVerifierPort,

    @Inject(REFRESH_SESSION_PERSISTENCE_PORT)
    private readonly sessionPersistence: RefreshSessionPersistencePort,

    @Inject(AUTH_TOKEN_ISSUER_PORT)
    private readonly tokenIssuer: AuthTokenIssuerPort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResultDto> {
    const verifiedToken = this.tokenVerifier.verify(command.refreshToken);

    const session = await this.sessionPersistence.findBySessionId(
      verifiedToken.sessionId,
    );

    this.assertSessionIsUsable(
      session,
      verifiedToken.userId,
      verifiedToken.familyId,
    );

    const presentedTokenHash = this.secureToken.hash(command.refreshToken);

    const tokenHashMatches = this.secureToken.equalsHash(
      presentedTokenHash,
      session.refreshTokenHash,
    );

    /*
     * Version hoặc hash không còn khớp nghĩa là refresh token cũ
     * đang bị sử dụng lại sau một lần rotation thành công.
     */
    if (
      verifiedToken.version !== session.refreshTokenVersion ||
      !tokenHashMatches
    ) {
      await this.revokeCompromisedFamily(session);
      throw new RefreshTokenReuseDetectedException();
    }

    const nextRefreshTokenVersion = session.refreshTokenVersion + 1;

    if (!Number.isSafeInteger(nextRefreshTokenVersion)) {
      throw new InvalidRefreshTokenException();
    }

    const tokens = this.tokenIssuer.issue({
      userId: session.userId,
      sessionId: session.sessionId,
      refreshTokenFamilyId: session.refreshTokenFamilyId,

      /*
       * Không tăng accessTokenVersion khi refresh bình thường.
       * Access token cũ tiếp tục sống đến khi hết TTL.
       */
      accessTokenVersion: session.accessTokenVersion,

      refreshTokenVersion: nextRefreshTokenVersion,
    });

    const rotatedAt = new Date();

    const rotated = await this.sessionPersistence.rotate({
      sessionId: session.sessionId,
      userId: session.userId,
      familyId: session.refreshTokenFamilyId,

      expectedRefreshTokenHash: session.refreshTokenHash,

      expectedRefreshTokenVersion: session.refreshTokenVersion,

      nextRefreshTokenHash: this.secureToken.hash(tokens.refreshToken),

      nextRefreshTokenVersion,

      rotatedAt,

      ipAddress: command.client.ipAddress,
      userAgent: command.client.userAgent,
    });

    /*
     * Một request khác đã rotate cùng token trước request này.
     * Request hiện tại được xem là reuse và phải revoke family.
     */
    if (!rotated) {
      await this.revokeCompromisedFamily(session);
      throw new RefreshTokenReuseDetectedException();
    }

    return RefreshTokenResultMapper.toDto(session.sessionId, tokens);
  }

  private assertSessionIsUsable(
    session: Awaited<
      ReturnType<RefreshSessionPersistencePort['findBySessionId']>
    > | null,
    expectedUserId: string,
    expectedFamilyId: string,
  ): asserts session is NonNullable<typeof session> {
    const now = new Date();

    if (
      !session ||
      session.userId !== expectedUserId ||
      session.refreshTokenFamilyId !== expectedFamilyId ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.userDeletedAt !== null ||
      session.accountStatus !== AuthAccountStatus.ACTIVE
    ) {
      throw new InvalidRefreshTokenException();
    }
  }

  private async revokeCompromisedFamily(
    session: NonNullable<
      Awaited<ReturnType<RefreshSessionPersistencePort['findBySessionId']>>
    >,
  ): Promise<void> {
    await this.sessionPersistence.revokeFamily({
      userId: session.userId,

      sessionId: session.sessionId,

      familyId: session.refreshTokenFamilyId,

      revokedAt: new Date(),

      reason: SessionRevocationReason.REFRESH_TOKEN_REUSE_DETECTED,
    });
  }
}
