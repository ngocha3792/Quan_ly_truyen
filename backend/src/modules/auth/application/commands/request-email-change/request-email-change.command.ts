export class RequestEmailChangeCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentPassword: string,

    readonly newEmail: string,
  ) {}
}
