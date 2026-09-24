import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { RevenueAllocationPersistence } from '../persistence/revenue-allocation.persistence';

@Injectable()
export class RevenueSettlementWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RevenueSettlementWorker.name);
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;
  private stopped = false;
  constructor(private readonly allocations: RevenueAllocationPersistence) {}
  onApplicationBootstrap() {
    this.schedule(0);
  }
  async onApplicationShutdown() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.active;
  }
  private schedule(delay: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.active = this.tick();
      void this.active.finally(() => this.schedule(60000));
    }, delay);
    this.timer.unref();
  }
  private async tick() {
    try {
      const result = await this.allocations.settlePending(100);
      if (result.settled)
        this.logger.log(`Released ${result.settled} due earning entries`);
    } catch {
      this.logger.error(
        'Revenue settlement failed; the next poll will retry the transaction',
      );
    }
  }
}
