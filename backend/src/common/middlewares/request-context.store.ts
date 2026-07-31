import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

import type { MutableRequestContext } from './request-context.interface';

@Injectable()
export class RequestContextStore {
  private readonly storage = new AsyncLocalStorage<MutableRequestContext>();

  run<T>(context: MutableRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): MutableRequestContext | undefined {
    return this.storage.getStore();
  }

  require(): MutableRequestContext {
    const context = this.get();

    if (!context) {
      throw new Error(
        'Request context is unavailable outside the HTTP request lifecycle',
      );
    }

    return context;
  }

  patch(values: Partial<MutableRequestContext>): MutableRequestContext {
    const context = this.require();

    Object.assign(context, values);

    return context;
  }
}
