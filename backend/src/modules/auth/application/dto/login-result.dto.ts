import type { RoleCode } from '@/common/enums';

export interface LoginUserDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  emailVerified: boolean;
  roles: readonly RoleCode[];
}

export interface LoginResultDto {
  sessionId: string;

  accessToken: string;
  refreshToken: string;

  tokenType: 'Bearer';

  accessTokenExpiresInSeconds: number;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;

  user: LoginUserDto;
}
