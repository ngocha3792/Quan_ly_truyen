export class GetReadingProgressQuery {
  constructor(
    readonly userId: string | undefined,
    readonly storyId: string,
  ) {}
}
