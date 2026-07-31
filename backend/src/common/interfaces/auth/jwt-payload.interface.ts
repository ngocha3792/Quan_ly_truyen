import { JwtTokenType } from '@/common/enums';

export interface JwtPayload {
  /**
   * Subject: user ID.
   */
  sub: string;

  /**
   * Session ID.
   */
  sid: string;

  /**
   * Token type.
   */
  typ: JwtTokenType;

  /**
   * Token version, dùng để revoke token.
   */
  ver: number;

  /**
   * JWT standard claims.
   */
  iat?: number;
  exp?: number;
  jti?: string;
}
export interface AccessTokenPayload extends JwtPayload {
  typ: JwtTokenType.ACCESS;
}

export interface RefreshTokenPayload extends JwtPayload {
  typ: JwtTokenType.REFRESH;
  familyId: string;
}
