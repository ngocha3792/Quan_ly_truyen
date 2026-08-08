import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import {
  AuthorAlreadyActiveException,
  AuthorApplicationPendingException,
  AuthorContactEmailValueObject,
  AuthorExperienceValueObject,
  AuthorFullNameValueObject,
  AuthorIntroductionValueObject,
  AuthorPenNameValueObject,
  AuthorPhoneValueObject,
  AuthorPortfolioUrlValueObject,
  AuthorPrimaryGenreValueObject,
  AuthorSynopsisValueObject,
} from '../../../domain';

import type { AuthorApplicationResultDto } from '../../dto';

import { AuthorApplicationResultMapper } from '../../mappers';

import {
  AUTHOR_APPLICATION_PERSISTENCE_PORT,
  type AuthorApplicationPersistencePort,
} from '../../ports';

import { SaveAuthorApplicationDraftCommand } from './save-author-application-draft.command';

@Injectable()
export class SaveAuthorApplicationDraftCommandHandler {
  constructor(
    @Inject(AUTHOR_APPLICATION_PERSISTENCE_PORT)
    private readonly persistence: AuthorApplicationPersistencePort,
  ) {}

  async execute(
    command: SaveAuthorApplicationDraftCommand,
  ): Promise<AuthorApplicationResultDto> {
    const userId = requireUserId(command.userId);

    const result = await this.persistence.saveDraft({
      userId,

      penName: AuthorPenNameValueObject.create(command.penName).value,

      fullName: AuthorFullNameValueObject.create(command.fullName).value,

      email: AuthorContactEmailValueObject.create(command.email).value,

      phone: AuthorPhoneValueObject.create(command.phone).value,

      portfolioUrl: AuthorPortfolioUrlValueObject.create(command.portfolioUrl)
        .value,

      primaryGenre: AuthorPrimaryGenreValueObject.create(command.primaryGenre)
        .value,

      experience: AuthorExperienceValueObject.create(command.experience).value,

      introduction: AuthorIntroductionValueObject.create(command.introduction)
        .value,

      firstWorkSynopsis: AuthorSynopsisValueObject.create(
        command.firstWorkSynopsis,
      ).value,

      acceptedTerms: command.acceptedTerms,
    });

    switch (result.status) {
      case 'saved':
        return AuthorApplicationResultMapper.toDto(result.application);

      case 'pending':
        throw new AuthorApplicationPendingException();

      case 'already_author':
      default:
        throw new AuthorAlreadyActiveException();
    }
  }
}

function requireUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'AUTHOR_APPLICATION_AUTHENTICATION_REQUIRED',

      message: 'Bạn cần đăng nhập để đăng ký trở thành tác giả',
    });
  }

  return userId;
}
