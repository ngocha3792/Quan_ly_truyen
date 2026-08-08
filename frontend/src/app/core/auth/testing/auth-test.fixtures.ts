import { CurrentUser, LoginResponse, RefreshTokenResponse } from '../auth.models';

export function createCurrentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 'user-1',

    sessionId: 'session-1',

    email: 'user@truyenhub.test',

    username: 'test_user',

    displayName: 'Test User',

    emailVerified: true,

    roles: ['USER'],

    bio: null,

    status: 'ACTIVE',

    emailVerifiedAt: '2026-08-01T00:00:00.000Z',

    lastLoginAt: '2026-08-07T12:00:00.000Z',

    avatar: null,

    authorProfile: null,

    permissions: ['library.manage.own', 'reading-history.manage.own', 'notification.manage.own'],

    createdAt: '2026-01-01T00:00:00.000Z',

    updatedAt: '2026-08-07T12:00:00.000Z',

    ...overrides,
  };
}

export function createLoginResponse(
  accessToken = 'access-token-v1',

  user: CurrentUser = createCurrentUser(),
): LoginResponse {
  return {
    sessionId: user.sessionId,

    accessToken,

    tokenType: 'Bearer',

    expiresIn: 900,

    expiresAt: '2026-08-07T13:00:00.000Z',

    user: {
      id: user.id,

      email: user.email,

      username: user.username,

      displayName: user.displayName,

      emailVerified: user.emailVerified,

      roles: user.roles,
    },
  };
}

export function createRefreshResponse(accessToken = 'access-token-v2'): RefreshTokenResponse {
  return {
    sessionId: 'session-1',

    accessToken,

    tokenType: 'Bearer',

    expiresIn: 900,

    expiresAt: '2026-08-07T13:00:00.000Z',
  };
}
