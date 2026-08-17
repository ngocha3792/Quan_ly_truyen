import type { ChapterSummaryResultDto } from '../dto';
import type { ChapterSummaryRecord } from '../ports';

export class ChapterSummaryResultMapper {
  static toDto(chapter: ChapterSummaryRecord): ChapterSummaryResultDto {
    return {
      id: chapter.id,
      storyId: chapter.storyId,
      number: chapter.number,
      title: chapter.title,
      slug: chapter.slug,
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
