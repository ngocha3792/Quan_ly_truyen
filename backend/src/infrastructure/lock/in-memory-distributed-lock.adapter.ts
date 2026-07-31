import { Injectable } from '@nestjs/common';

import { ConcurrencyConflictException } from '@/common/exceptions';
import type {
  DistributedLock,
  LockOptions,
} from './distributed-lock.interface';

@Injectable()
export class InMemoryDistributedLock implements DistributedLock {
  private readonly locks = new Set<string>();

  async withLock<T>(
    key: string,
    options: LockOptions,
    work: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    const waitMs = options.waitMs ?? 0;

    let acquired = false;

    while (!acquired) {
      if (!this.locks.has(key)) {
        this.locks.add(key);
        acquired = true;
        break;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= waitMs) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(20, waitMs - elapsed)),
      );
    }

    if (!acquired) {
      throw new ConcurrencyConflictException({
        resource: key,
        message: `Không thể khóa tài nguyên [${key}] do xung đột tiến trình (in-memory)`,
      });
    }

    try {
      return await work();
    } finally {
      this.locks.delete(key);
    }
  }
}
