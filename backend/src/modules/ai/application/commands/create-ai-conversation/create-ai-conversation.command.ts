import type { AiProvider } from '@/generated/prisma/client';

export class CreateAiConversationCommand {
  constructor(
    readonly userId: string,
    readonly provider: AiProvider,
    readonly title: string,
  ) {}
}
