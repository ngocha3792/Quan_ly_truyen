export class ChangePasswordCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,

    readonly currentPassword: string,

    readonly newPassword: string,
  ) {}
}
