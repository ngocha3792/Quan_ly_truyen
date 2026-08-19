export class UnfollowAuthorCommand {
  constructor(
    readonly userId: string,
    readonly authorId: string,
  ) {}
}
