import type { AiProvider } from '@/generated/prisma/client';
import type { AiKeyStatusView } from '../../../application/queries/list-ai-keys/list-ai-keys.view';

export interface AiKeyStatusResponse {
  readonly provider: AiProvider;
  readonly configured: boolean;
  readonly lastFour: string | null;
  readonly updatedAt: string | null;
}

export function toAiKeyStatusResponse(
  view: AiKeyStatusView,
): AiKeyStatusResponse {
  return {
    provider: view.provider,
    configured: view.configured,
    lastFour: view.lastFour,
    updatedAt: view.updatedAt,
  };
}
