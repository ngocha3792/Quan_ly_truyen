import type { ChapterResultDto } from '../dto';
import type { ChapterRecord } from '../ports';

export class ChapterResultMapper {
  static toDto(chapter: ChapterRecord): ChapterResultDto {
    return {
      id: chapter.id,
      storyId: chapter.storyId,
      createdById: chapter.createdById,
      updatedById: chapter.updatedById,
      number: chapter.number,
      title: chapter.title,
      slug: chapter.slug,
      content: chapter.content,
      contentFormat: chapter.contentFormat,
      status: chapter.status,
      wordCount: chapter.wordCount,
      version: chapter.version,
      scheduledAt: chapter.scheduledAt,
      publishedAt: chapter.publishedAt,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    };
  }
}
