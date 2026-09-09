import { Injectable } from '@nestjs/common';
import { chapterVersionDiff } from '../../../domain/policies/chapter-version-diff.policy';
import { GetAuthorChapterVersionQueryHandler } from '../get-author-chapter-version/get-author-chapter-version.query-handler';
import { GetAuthorChapterVersionQuery } from '../get-author-chapter-version/get-author-chapter-version.query';

@Injectable()
export class GetVersionDiffQueryHandler {
  constructor(private readonly versions: GetAuthorChapterVersionQueryHandler) {}

  async execute(
    userId: string | undefined,
    storyId: string,
    chapterId: string,
    from: number,
    to: number,
  ) {
    // Both lookups enforce the same chapter/story/editor scope as version detail.
    const [before, after] = await Promise.all([
      this.versions.execute(
        new GetAuthorChapterVersionQuery(userId, storyId, chapterId, from),
      ),
      this.versions.execute(
        new GetAuthorChapterVersionQuery(userId, storyId, chapterId, to),
      ),
    ]);
    return {
      fromVersion: before.version,
      toVersion: after.version,
      ...chapterVersionDiff(before.content, after.content),
      titleChanges: chapterVersionDiff(before.title, after.title).changes,
    };
  }
}
