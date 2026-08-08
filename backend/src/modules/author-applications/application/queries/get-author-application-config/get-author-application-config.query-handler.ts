import { Injectable } from '@nestjs/common';

import { AuthorApplicationPolicy } from '../../../domain';

import type { AuthorApplicationConfigResultDto } from '../../dto';

import { GetAuthorApplicationConfigQuery } from './get-author-application-config.query';

@Injectable()
export class GetAuthorApplicationConfigQueryHandler {
  execute(
    _query: GetAuthorApplicationConfigQuery,
  ): AuthorApplicationConfigResultDto {
    return {
      genreOptions: AuthorApplicationPolicy.GENRES,

      experienceOptions: AuthorApplicationPolicy.EXPERIENCES,

      requirements: AuthorApplicationPolicy.REQUIREMENTS,

      reviewSteps: AuthorApplicationPolicy.REVIEW_STEPS,

      benefits: AuthorApplicationPolicy.BENEFITS,

      acceptedFileExtensions: AuthorApplicationPolicy.SAMPLE_FILE_EXTENSIONS,

      maximumFileSizeMb: AuthorApplicationPolicy.SAMPLE_MAXIMUM_FILE_SIZE_MB,

      introductionMaximumLength:
        AuthorApplicationPolicy.INTRODUCTION_MAX_LENGTH,

      synopsisMaximumLength: AuthorApplicationPolicy.SYNOPSIS_MAX_LENGTH,
    };
  }
}
