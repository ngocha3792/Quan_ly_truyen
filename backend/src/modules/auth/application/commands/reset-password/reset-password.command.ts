export class ResetPasswordCommand {
  constructor(
    readonly token: string,
    readonly newPassword: string,
  ) {}
}
