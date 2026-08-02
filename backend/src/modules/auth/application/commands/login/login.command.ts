export interface LoginClientContext {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
}

export class LoginCommand {
  constructor(
    readonly identifier: string,
    readonly password: string,
    readonly client: LoginClientContext,
  ) {}
}
