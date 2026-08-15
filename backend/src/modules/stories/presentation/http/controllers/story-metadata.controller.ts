import { Controller, Get } from '@nestjs/common';

import { RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  ListStoryCategoriesQuery,
  ListStoryCategoriesQueryHandler,
  ListStoryTagsQuery,
  ListStoryTagsQueryHandler,
  type StoryCategoryOptionDto,
  type StoryTagOptionDto,
} from '../../../application';

@Controller('story-metadata')
export class StoryMetadataController {
  constructor(
    private readonly listCategories: ListStoryCategoriesQueryHandler,
    private readonly listTags: ListStoryTagsQueryHandler,
  ) {}

  @Get('categories')
  @RequirePermissions(PermissionCode.STORY_CREATE)
  getCategories(): Promise<readonly StoryCategoryOptionDto[]> {
    return this.listCategories.execute(new ListStoryCategoriesQuery());
  }

  @Get('tags')
  @RequirePermissions(PermissionCode.STORY_CREATE)
  getTags(): Promise<readonly StoryTagOptionDto[]> {
    return this.listTags.execute(new ListStoryTagsQuery());
  }
}
