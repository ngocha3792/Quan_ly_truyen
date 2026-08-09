import { Logger } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  AuthorAlreadyActiveException,
  AuthorApplicationNotFoundException,
  AuthorApplicationNotPendingException,
  AuthorApplicationSelfReviewException,
  AuthorApplicationStatus,
  AuthorPenNameUnavailableException,
  AuthorRoleUnavailableException,
} from '../../../domain';

import {
  APPLICATION_ID,
  createAuthorApplication,
  OWNER_ID,
  REVIEWER_ID,
} from '../author-application-command-handler.spec.fixture';

import { ApproveAuthorApplicationCommand } from './approve-author-application.command';

import { ApproveAuthorApplicationCommandHandler } from './approve-author-application.command-handler';

describe('ApproveAuthorApplicationCommandHandler', () => {
  let persistence: {    approve: jest.Mock;  };
  let authorizationInvalidation: {    invalidateUser: jest.Mock;  };
  let handler: ApproveAuthorApplicationCommandHandler;

  beforeEach(() => {    persistence = {      approve: jest.fn(),    };
    authorizationInvalidation = {      invalidateUser: jest.fn().mockResolvedValue(undefined),    };
    handler = new ApproveAuthorApplicationCommandHandler(      persistence as never,
      authorizationInvalidation,    );  });
  afterEach(() => {    jest.restoreAllMocks();  });
  it('yêu cầu reviewer UUID hợp lệ', async () => {    await expect(      handler.execute(        new ApproveAuthorApplicationCommand(          APPLICATION_ID,          undefined,        ),      ),    ).rejects.toBeInstanceOf(AuthenticationRequiredException);    expect(persistence.approve).not.toHaveBeenCalled();  });
  it('approve và invalidate authorization sau DB commit', async () => {    persistence.approve.mockResolvedValue({      status: 'approved',      application: createAuthorApplication(        AuthorApplicationStatus.APPROVED,      ),      userId: OWNER_ID,    });    const result = await handler.execute(      new ApproveAuthorApplicationCommand(        APPLICATION_ID,        REVIEWER_ID,        '127.0.0.1',        'Jest',        'approve-request',      ),    );    expect(persistence.approve).toHaveBeenCalledWith({      applicationId: APPLICATION_ID,      reviewerId: REVIEWER_ID,      reviewedAt: expect.any(Date) as unknown,      audit: {        ipAddress: '127.0.0.1',        userAgent: 'Jest',        requestId: 'approve-request',      },    });    expect(      authorizationInvalidation.invalidateUser,    ).toHaveBeenCalledWith(OWNER_ID);    expect(result.status).toBe(      AuthorApplicationStatus.APPROVED,    );  });
  it('DB commit vẫn thành công nếu cache invalidation fail', async () => {    jest      .spyOn(Logger.prototype, 'warn')      .mockImplementation(() => undefined);    persistence.approve.mockResolvedValue({      status: 'approved',      application: createAuthorApplication(        AuthorApplicationStatus.APPROVED,      ),      userId: OWNER_ID,    });    authorizationInvalidation.invalidateUser.mockRejectedValue(      new Error('Redis unavailable'),    );    const result = await handler.execute(      new ApproveAuthorApplicationCommand(        APPLICATION_ID,        REVIEWER_ID,      ),    );    expect(result.status).toBe(      AuthorApplicationStatus.APPROVED,    );  });
  it.each([    [      'not_found',      {        status: 'not_found',      },      AuthorApplicationNotFoundException,    ],    [      'not_pending',      {        status: 'not_pending',      },      AuthorApplicationNotPendingException,    ],    [      'self_review',      {        status: 'self_review',      },      AuthorApplicationSelfReviewException,    ],    [      'pen_name_unavailable',      {        status: 'pen_name_unavailable',        penName: 'Coverage Author',      },      AuthorPenNameUnavailableException,    ],    [      'role_missing',      {        status: 'role_missing',      },      AuthorRoleUnavailableException,    ],    [      'already_author',      {        status: 'already_author',      },      AuthorAlreadyActiveException,    ],  ])(    'map persistence status %s thành domain exception',    async (_status, persistenceResult, ExceptionType) => {      persistence.approve.mockResolvedValue(        persistenceResult,      );      await expect(        handler.execute(          new ApproveAuthorApplicationCommand(            APPLICATION_ID,            REVIEWER_ID,          ),        ),      ).rejects.toBeInstanceOf(ExceptionType);    },  );});
