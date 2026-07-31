import { AuthPrincipal } from '@/common/interfaces/auth';

export interface RequestContext {
  requestId: string;
  correlationId?: string;
  traceId?: string;

  principal: AuthPrincipal | null;

  ipAddress?: string;
  userAgent?: string;
  locale?: string;

  startedAt: Date;
}
