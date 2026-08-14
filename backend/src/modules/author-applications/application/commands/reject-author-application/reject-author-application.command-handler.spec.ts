import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  AuthorApplicationNotFoundException,
  AuthorApplicationNotPendingException,
  AuthorApplicationSelfReviewException,
  AuthorApplicationStatus,
} from '../../../domain';

import {
  APPLICATION_ID,
  createAuthorApplication,
  REVIEWER_ID,
} from '../author-application-command-handler.spec.fixture';

import { RejectAuthorApplicationCommand } from './reject-author-application.command';

import { RejectAuthorApplicationCommandHandler } from './reject-author-application.command-handler';

describe('RejectAuthorApplicationCommandHandler', () => {
  const reason = 'Mẫu nội dung chưa đáp ứng tiêu chí xét duyệt.';

  let persistence: {
    reject: jest.Mock;
  };

  let handler: RejectAuthorApplicationCommandHandler;

  beforeEach(() => {
    persistence = {
      reject: jest.fn(),
    };

    handler = new RejectAuthorApplicationCommandHandler(persistence as never);
  });

  it('yêu cầu reviewer UUID hợp lệ', async () => {
    await expect(
      handler.execute(
        new RejectAuthorApplicationCommand(
          APPLICATION_ID,

          undefined,

          reason,
        ),
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.reject).not.toHaveBeenCalled();
  });

  it('reject hồ sơ và normalize rejection reason', async () => {
    persistence.reject.mockResolvedValue({
      status: 'rejected',

      application: createAuthorApplication(AuthorApplicationStatus.REJECTED),
    });

    const result = await handler.execute(
      new RejectAuthorApplicationCommand(
        APPLICATION_ID,

        REVIEWER_ID,

        `   ${reason}   `,

        '127.0.0.1',

        'Jest',

        'reject-request',
      ),
    );

    expect(persistence.reject).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,

      reviewerId: REVIEWER_ID,

      reason,

      reviewedAt: expect.any(Date) as unknown,

      audit: {
        ipAddress: '127.0.0.1',

        userAgent: 'Jest',

        requestId: 'reject-request',
      },
    });

    expect(result.status).toBe(AuthorApplicationStatus.REJECTED);
  });

  it.each([
    [
      'not_found',
      {
        status: 'not_found',
      },
      AuthorApplicationNotFoundException,
    ],

    [
      'self_review',
      {
        status: 'self_review',
      },
      AuthorApplicationSelfReviewException,
    ],

    [
      'not_pending',
      {
        status: 'not_pending',
      },
      AuthorApplicationNotPendingException,
    ],
  ])(
    'map persistence status %s thành domain exception',

    async (_status, persistenceResult, ExceptionType) => {
      persistence.reject.mockResolvedValue(persistenceResult);

      await expect(
        handler.execute(
          new RejectAuthorApplicationCommand(
            APPLICATION_ID,

            REVIEWER_ID,

            reason,
          ),
        ),
      ).rejects.toBeInstanceOf(ExceptionType);
    },
  );
});
