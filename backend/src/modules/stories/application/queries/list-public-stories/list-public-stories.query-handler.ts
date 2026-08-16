import { Inject, Injectable } from '@nestjs/common';

import type { PublicStoryPageDto } from '../../dto';
import { STORY_PERSISTENCE_PORT, type StoryPersistencePort } from '../../ports';
import { InvalidStoryFieldException } from '../../../domain';
import { ListPublicStoriesQuery } from './list-public-stories.query';

@Injectable()
export class ListPublicStoriesQueryHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(query: ListPublicStoriesQuery): Promise<PublicStoryPageDto> {
    if (
      query.yearFrom !== undefined &&
      query.yearTo !== undefined &&
      query.yearFrom > query.yearTo
    ) {
      throw new InvalidStoryFieldException(
        'yearFrom',
        'Năm bắt đầu không được lớn hơn năm kết thúc',
      );
    }

    return this.persistence.listPublic({
      q: normalizeOptionalText(query.q),
      genre: normalizeOptionalSlug(query.genre),
      status: query.status,
      sort: query.sort,
      yearFrom: query.yearFrom,
      yearTo: query.yearTo,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalSlug(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalText(value);
  return normalized?.toLowerCase();
}
