export class ListPublicStoryChaptersQuery {
  constructor(
    readonly storySlug: string,
    readonly page: number,
    readonly pageSize: number,
  ) {}
}
