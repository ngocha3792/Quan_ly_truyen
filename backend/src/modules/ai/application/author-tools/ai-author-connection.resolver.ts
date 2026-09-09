import { Injectable } from '@nestjs/common';
import {
  AiConnectionResolver,
  AiResolvedConnectionFactory,
} from '../connection-resolution';
import { AuthorJobError } from './ai-author.types';

@Injectable()
export class AiAuthorConnectionResolver {
  constructor(
    private readonly resolver: AiConnectionResolver,
    private readonly factory: AiResolvedConnectionFactory,
  ) {}
  async resolve(userId: string, connectionId: string) {
    const plan = await this.resolver.resolvePlan({ userId, connectionId });
    // An explicit but revoked/foreign connection must never silently select another one.
    if (!plan || plan.primary.id !== connectionId)
      throw new AuthorJobError('CONNECTION_UNAVAILABLE');
    return plan;
  }
  async execution(userId: string, connectionId: string) {
    const plan = await this.resolve(userId, connectionId);
    return {
      primary: await this.factory.fromRecord(plan.primary),
      fallback: plan.systemFallback
        ? {
            connection: await this.factory.fromRecord(plan.systemFallback),
            connectionId: plan.systemFallback.id,
          }
        : null,
    };
  }
}
