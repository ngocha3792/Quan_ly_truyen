export interface UpdateAiConnectionChanges {
  readonly name?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string | null;
  readonly defaultModel?: string | null;
  readonly enabled?: boolean;
}

export class UpdateAiConnectionCommand {
  constructor(
    readonly userId: string | null,
    readonly connectionId: string,
    readonly changes: UpdateAiConnectionChanges,
  ) {}
}
