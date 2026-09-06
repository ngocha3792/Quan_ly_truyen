export class RequestChapterTranslationCommand {
  constructor(
    readonly userId: string,
    readonly storyId: string,
    readonly chapterId: string,
    readonly targetLanguageCode: string,
    readonly connectionId?: string,
  ) {}
}
