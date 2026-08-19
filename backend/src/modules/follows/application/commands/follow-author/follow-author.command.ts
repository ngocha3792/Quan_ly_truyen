export class FollowAuthorCommand {
  constructor(
    readonly userId: string,
    readonly authorId: string,
  ) {}
}
