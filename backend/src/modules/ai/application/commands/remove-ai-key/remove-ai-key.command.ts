import type { AiProvider } from '@/generated/prisma/client';

export class RemoveAiKeyCommand {
  constructor(
    readonly userId: string | null,
    readonly provider: AiProvider,
  ) {}
}
