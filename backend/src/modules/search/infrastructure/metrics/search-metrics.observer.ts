import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import searchConfig from '@/config/search.config';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import { SearchMetricsAdapter } from './search-metrics.adapter';

/** API exposes worker progress from PostgreSQL on the existing metrics endpoint. */
@Injectable()
export class SearchMetricsObserver
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SearchMetricsObserver.name);
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;
  private stopped = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchMetrics: SearchMetricsAdapter,
    private readonly metrics: MetricsService,
    @Inject(searchConfig.KEY)
    private readonly config: ConfigType<typeof searchConfig>,
  ) {}
  onApplicationBootstrap(): void {
    if (this.config.enabled && this.metrics.isEnabled()) this.schedule(0);
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.active;
  }
  async collect(): Promise<void> {
    try {
      const [oldest, checkpoint] = await Promise.all([
        this.prisma.searchDirtyDocument.findFirst({
          orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
          select: { changedAt: true },
        }),
        this.prisma.searchIndexCheckpoint.findUnique({
          where: { indexName: this.config.index },
          select: { failedDocuments: true },
        }),
      ]);
      if (!this.stopped)
        this.searchMetrics.snapshot(
          oldest?.changedAt ?? null,
          checkpoint?.failedDocuments ?? 0,
        );
    } catch {
      if (!this.stopped)
        this.logger.warn({ event: 'search.metrics.snapshot_failed' });
    }
  }
  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      if (this.stopped) return;
      this.active = this.collect().finally(() => {
        if (!this.stopped) this.schedule(15000);
      });
    }, delay);
    this.timer.unref();
  }
}
