import type { AiAuthType, AiProtocol } from '../../../domain/enums';

export class CreateAiConnectionCommand {
  constructor(
    readonly userId: string | null,
    readonly name: string,
    readonly vendorHint: string | null,
    readonly protocol: AiProtocol,
    readonly authType: AiAuthType,
    readonly authHeaderName: string | null,
    readonly credential: string,
    readonly baseUrl: string,
    readonly defaultModel: string | null,
  ) {}
}
