import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/infrastructure/database';
import { sanitizeErrorForLog } from '@/common/utils';
import type { QueueConfig } from '@/config';

/** Worker-only housekeeping. Retained, current and reader-referenced snapshots survive. */
@Injectable()
export class ChapterEditorMaintenanceScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ChapterEditorMaintenanceScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.config.get<QueueConfig>('queue')?.enabled) return;
    this.timer = setInterval(() => void this.tick(), 60 * 60 * 1000);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        const locks = await tx.$queryRaw<
          { locked: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(6091007) AS locked`;
        if (!locks[0]?.locked) return;
        await tx.$executeRaw`
          DELETE FROM chapter_versions WHERE id IN (
            SELECT v.id FROM chapter_versions v JOIN chapters c ON c.id = v.chapter_id
            WHERE v.version_type = 'autosave' AND NOT v.is_retained
              AND v.expires_at < CURRENT_TIMESTAMP AND v.version <> c.version
              AND NOT EXISTS (SELECT 1 FROM chapter_reviews r WHERE r.chapter_id = v.chapter_id AND r.reviewed_version = v.version)
            ORDER BY v.expires_at, v.id LIMIT 500 FOR UPDATE OF v SKIP LOCKED
          )`;
        await tx.$executeRaw`
          DELETE FROM chapter_edit_sessions WHERE id IN (
            SELECT id FROM chapter_edit_sessions WHERE expires_at < CURRENT_TIMESTAMP
            ORDER BY expires_at, id LIMIT 500 FOR UPDATE SKIP LOCKED
          )`;
      });
    } catch (error: unknown) {
      this.logger.error(
        'Chapter editor maintenance failed',
        sanitizeErrorForLog(error),
      );
    } finally {
      this.running = false;
    }
  }
}
