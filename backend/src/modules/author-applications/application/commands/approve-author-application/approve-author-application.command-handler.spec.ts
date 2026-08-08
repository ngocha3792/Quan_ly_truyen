import { Logger } from '@nestjs/common';

import { AuthorApplicationStatus } from '../../../domain';

import type { AuthorApplicationRecord } from '../../ports';

import { ApproveAuthorApplicationCommand } from './approve-author-application.command';

import { ApproveAuthorApplicationCommandHandler } from './approve-author-application.command-handler';

describe('ApproveAuthorApplicationCommandHandler', () => {
  const applicationId = '11111111-1111-4111-8111-111111111111';

  const ownerId = '22222222-2222-4222-8222-222222222222';

  const reviewerId = '33333333-3333-4333-8333-333333333333';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('vẫn trả approve thành công nếu cache invalidation fail sau DB commit', async () => {
    const spyLoggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const application = createApprovedApplication();

    const persistence = {
      approve: jest.fn().mockResolvedValue({
        status: 'approved',

        application,

        userId: ownerId,
      }),
    };

    const invalidateUser = jest
      .fn()
      .mockRejectedValue(new Error('Redis unavailable'));

    const authorizationInvalidation = {
      invalidateUser,
    };

    const handler = new ApproveAuthorApplicationCommandHandler(
      persistence as never,

      authorizationInvalidation,
    );

    const result = await handler.execute(
      new ApproveAuthorApplicationCommand(
        applicationId,

        reviewerId,

        '127.0.0.1',

        'Jest',

        'request-1',
      ),
    );

    expect(result.status).toBe(AuthorApplicationStatus.APPROVED);

    expect(result.applicationId).toBe(applicationId);

    expect(invalidateUser).toHaveBeenCalledWith(ownerId);

    expect(spyLoggerWarn).toHaveBeenCalled();
  });

  function createApprovedApplication(): AuthorApplicationRecord {
    const now = new Date('2026-08-08T03:00:00.000Z');

    return {
      id: applicationId,

      userId: ownerId,

      status: AuthorApplicationStatus.APPROVED,

      penName: 'Integration Author',

      fullName: 'Author Name',

      email: 'author@example.test',

      phone: '0900000000',

      portfolioUrl: null,

      primaryGenre: 'Fantasy',

      experience: '1-3-years',

      introduction: 'Introduction',

      firstWorkSynopsis: 'Synopsis',

      acceptedTerms: true,

      sample: null,

      submittedAt: now,

      reviewedAt: now,

      reviewedById: reviewerId,

      rejectionReason: null,

      createdAt: now,

      updatedAt: now,
    };
  }
});
