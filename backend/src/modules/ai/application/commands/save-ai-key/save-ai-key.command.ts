import type { AiProvider } from '@/generated/prisma/client';

export class SaveAiKeyCommand {
  constructor(
    readonly userId: string | null,
    readonly provider: AiProvider,
    readonly apiKey: string,
  ) {}
}
