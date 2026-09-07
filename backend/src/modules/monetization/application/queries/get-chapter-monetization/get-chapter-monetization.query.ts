export class GetChapterMonetizationQuery {
  constructor(
    readonly actorId: string | undefined,
    readonly storyId: string,
    readonly chapterId: string,
  ) {}
}
