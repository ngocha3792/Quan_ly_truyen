export class ListStoryCommentsQuery {
  constructor(
    readonly storySlug: string,
    readonly page: number,
    readonly pageSize: number,
  ) {}
}
