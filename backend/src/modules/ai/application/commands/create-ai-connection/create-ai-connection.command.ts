import type { AiProvider } from '../../../domain/enums';

export class CreateAiConnectionCommand {
  constructor(
    readonly userId: string | null,
    readonly name: string,
    readonly provider: AiProvider,
    readonly apiKey: string,
    readonly baseUrl: string | null,
    readonly defaultModel: string | null,
  ) {}
}
