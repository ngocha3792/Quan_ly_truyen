export class ProbeAiConnectionCapabilitiesCommand {
  constructor(
    readonly userId: string | null,
    readonly connectionId: string,
  ) {}
}
