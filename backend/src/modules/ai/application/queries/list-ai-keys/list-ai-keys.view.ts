import type { AiProvider } from '@/generated/prisma/client';

export interface AiKeyStatusView {
  readonly provider: AiProvider;
  readonly configured: boolean;
  readonly lastFour: string | null;
  readonly updatedAt: string | null;
}
