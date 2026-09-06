export class GetChapterTranslationQuery {
  constructor(
    readonly userId: string,
    readonly storyId: string,
    readonly chapterId: string,
    readonly targetLanguageCode: string,
  ) {}
}
