import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AnalyticsConfig } from '@/config';
import { addUtcDays, analyticsDate, dateKeyFromUtcDate } from '../domain/analytics-time.util';
import { AnalyticsReconciliationService } from './analytics-reconciliation.service';

@Injectable()
export class AnalyticsMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastSettledDate?: string;
  private readonly analytics: AnalyticsConfig;

  constructor(
    config: ConfigService,
    private readonly reconciliation: AnalyticsReconciliationService,
  ) {
    this.analytics = config.getOrThrow<AnalyticsConfig>('analytics');
  }

  onModuleInit(): void {
    if (!this.analytics.enabled) return;
    this.timer = setInterval(() => void this.tick(), 5 * 60_000);
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running || !this.analytics.enabled) return;
    this.running = true;
    try {
      const today = analyticsDate(now, this.analytics.timeZone);
      const yesterday = addUtcDays(today, -1);
      await this.reconciliation.recomputeUniqueReaders(dateKeyFromUtcDate(today));
      await this.reconciliation.recomputeUniqueReaders(dateKeyFromUtcDate(yesterday));

      // Events may be backdated up to 24h. Finalize D-2 only when the lateness
      // window has closed and there is no unprocessed backlog for that day.
      const settled = dateKeyFromUtcDate(addUtcDays(today, -2));
      if (this.lastSettledDate !== settled) {
        const finalized = await this.reconciliation.reconcileSettledDate(settled);
        if (finalized) this.lastSettledDate = settled;
      }

      // One bounded retention batch per maintenance tick. Large tables are
      // drained gradually instead of a single long-running DELETE transaction.
      await this.reconciliation.cleanupProcessedBatch();
    } finally {
      this.running = false;
    }
  }
}
