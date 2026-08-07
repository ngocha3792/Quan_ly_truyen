export class RequestRecoveryEmailCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,

    readonly email: string,

    readonly currentPassword: string,
  ) {}
}

export class VerifyRecoveryEmailCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,

    readonly code: string,
  ) {}
}

export class ResendRecoveryEmailCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,
  ) {}
}

export class RemoveRecoveryEmailCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,

    readonly currentPassword: string,
  ) {}
}
