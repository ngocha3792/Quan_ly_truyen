import type { AiAuthType, AiProtocol } from '../../../domain/enums';

export interface UpdateAiConnectionChanges {
  readonly name?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string | null;
  readonly defaultModel?: string | null;
  readonly enabled?: boolean;
  readonly authType?: AiAuthType;
  readonly authHeaderName?: string | null;
  readonly protocol?: AiProtocol;
}

export class UpdateAiConnectionCommand {
  constructor(
    readonly userId: string | null,
    readonly connectionId: string,
    readonly changes: UpdateAiConnectionChanges,
    readonly actorUserId: string | null = userId,
  ) {}
}
