import type { StoryResultDto } from '../dto';
import type { StoryRecord } from '../ports';

export class StoryResultMapper {
  static toDto(story: StoryRecord): StoryResultDto {
    return {
      id: story.id,
      authorId: story.authorId,
      title: story.title,
      slug: story.slug,
      synopsis: story.synopsis,
      languageCode: story.languageCode,
      status: story.status,
      visibility: story.visibility,
      contentRating: story.contentRating,
      coverMediaId: story.coverMediaId,
      publishedAt: story.publishedAt,
      categories: story.categories.map((category) => ({ ...category })),
      tags: story.tags.map((tag) => ({ ...tag })),
      version: story.version,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }
}
