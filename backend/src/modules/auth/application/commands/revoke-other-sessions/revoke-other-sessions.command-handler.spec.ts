import {
  AuthenticationRequiredException,
} from '@/common/exceptions';

import {
  SessionRevocationReason,
} from '../../../domain/enums';

import {
  RevokeOtherSessionsCommand,
} from './revoke-other-sessions.command';

import {
  RevokeOtherSessionsCommandHandler,
} from './revoke-other-sessions.command-handler';

describe(
  'RevokeOtherSessionsCommandHandler',

  () => {
    const userId =
      '11111111-1111-4111-8111-111111111111';

    const actorSessionId =
      '22222222-2222-4222-8222-222222222222';

    let persistence: {
      revokeOtherUserSessions: jest.Mock;
    };

    let handler:
      RevokeOtherSessionsCommandHandler;

    beforeEach(() => {
      persistence = {
        revokeOtherUserSessions: jest
          .fn()
          .mockResolvedValue(3),
      };

      handler =
        new RevokeOtherSessionsCommandHandler(
          persistence as never,
        );
    });

    it(
      'revokes all other active sessions and preserves the actor session',

      async () => {
        const result =
          await handler.execute(
            new RevokeOtherSessionsCommand(
              userId,

              actorSessionId,
            ),
          );

        expect(
          result,
        ).toBe(3);

        expect(
          persistence.revokeOtherUserSessions,
        ).toHaveBeenCalledTimes(1);

        expect(
          persistence.revokeOtherUserSessions,
        ).toHaveBeenCalledWith({
          userId,

          actorSessionId,

          revokedAt:
            expect.any(Date),

          reason:
            SessionRevocationReason.USER_REVOKED_SESSION,
        });
      },
    );

    it(
      'rejects request without a valid authenticated user',

      async () => {
        await expect(
          handler.execute(
            new RevokeOtherSessionsCommand(
              undefined,

              actorSessionId,
            ),
          ),
        ).rejects.toBeInstanceOf(
          AuthenticationRequiredException,
        );

        expect(
          persistence.revokeOtherUserSessions,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects request without a valid current session',

      async () => {
        await expect(
          handler.execute(
            new RevokeOtherSessionsCommand(
              userId,

              'invalid-session-id',
            ),
          ),
        ).rejects.toBeInstanceOf(
          AuthenticationRequiredException,
        );

        expect(
          persistence.revokeOtherUserSessions,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
