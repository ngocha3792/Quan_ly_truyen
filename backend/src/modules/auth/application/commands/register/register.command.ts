export class RegisterCommand {
  constructor(
    readonly email: string,
    readonly username: string,
    readonly password: string,
    readonly displayName: string,
  ) {}
}
