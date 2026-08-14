import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';

import {
  AuthorAlreadyActiveException,
  AuthorApplicationIncompleteException,
  AuthorApplicationNotFoundException,
  AuthorApplicationStatus,
  AuthorPenNameUnavailableException,
  InvalidAuthorApplicationSampleException,
} from '../../../domain';

import {
  APPLICATION_ID,
  createAuthorApplication,
  OWNER_ID,
  SAMPLE_MEDIA_ID,
} from '../author-application-command-handler.spec.fixture';

import { SubmitAuthorApplicationCommand } from './submit-author-application.command';

import { SubmitAuthorApplicationCommandHandler } from './submit-author-application.command-handler';
describe('SubmitAuthorApplicationCommandHandler', () => {
  let persistence: {
    submit: jest.Mock;
  };

  let handler: SubmitAuthorApplicationCommandHandler;

  beforeEach(() => {
    persistence = {
      submit: jest.fn(),
    };

    handler = new SubmitAuthorApplicationCommandHandler(persistence as never);
  });

  it('yêu cầu authenticated user UUID hợp lệ', async () => {
    await expect(
      handler.execute(
        new SubmitAuthorApplicationCommand(
          undefined,

          APPLICATION_ID,

          SAMPLE_MEDIA_ID,
        ),
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.submit).not.toHaveBeenCalled();
  });

  it.each([
    ['application id', 'invalid-application-id', SAMPLE_MEDIA_ID],

    ['sample media id', APPLICATION_ID, 'invalid-media-id'],
  ])(
    'từ chối %s không phải UUID v4',

    async (_field, applicationId, sampleMediaId) => {
      await expect(
        handler.execute(
          new SubmitAuthorApplicationCommand(
            OWNER_ID,

            applicationId,

            sampleMediaId,
          ),
        ),
      ).rejects.toBeInstanceOf(InvalidInputException);

      expect(persistence.submit).not.toHaveBeenCalled();
    },
  );

  it('submit hồ sơ với audit context', async () => {
    persistence.submit.mockResolvedValue({
      status: 'submitted',

      application: createAuthorApplication(AuthorApplicationStatus.PENDING),
    });

    const result = await handler.execute(
      new SubmitAuthorApplicationCommand(
        OWNER_ID,

        APPLICATION_ID,

        SAMPLE_MEDIA_ID,

        '127.0.0.1',

        'Jest',

        'submit-request',
      ),
    );

    expect(persistence.submit).toHaveBeenCalledWith({
      userId: OWNER_ID,

      applicationId: APPLICATION_ID,

      sampleMediaId: SAMPLE_MEDIA_ID,

      submittedAt: expect.any(Date) as unknown,

      audit: {
        ipAddress: '127.0.0.1',

        userAgent: 'Jest',

        requestId: 'submit-request',
      },
    });

    expect(result.status).toBe(AuthorApplicationStatus.PENDING);
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
      'already_author',
      {
        status: 'already_author',
      },
      AuthorAlreadyActiveException,
    ],

    [
      'incomplete',
      {
        status: 'incomplete',

        missingFields: ['introduction', 'acceptedTerms'],
      },
      AuthorApplicationIncompleteException,
    ],

    [
      'invalid_sample',
      {
        status: 'invalid_sample',
      },
      InvalidAuthorApplicationSampleException,
    ],

    [
      'pen_name_unavailable',
      {
        status: 'pen_name_unavailable',

        penName: 'Coverage Author',
      },
      AuthorPenNameUnavailableException,
    ],
  ])(
    'map persistence status %s thành domain exception',

    async (_status, persistenceResult, ExceptionType) => {
      persistence.submit.mockResolvedValue(persistenceResult);

      await expect(
        handler.execute(
          new SubmitAuthorApplicationCommand(
            OWNER_ID,

            APPLICATION_ID,

            SAMPLE_MEDIA_ID,
          ),
        ),
      ).rejects.toBeInstanceOf(ExceptionType);
    },
  );
});
