import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import searchConfig from '@/config/search.config';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { ServiceUnavailableException } from '@/common/exceptions';
import {
  SEARCH_ENGINE_PORT,
  type SearchAdminPort,
  type SearchEnginePort,
} from '../../application/ports/search.port';
import { SearchSourceRepository } from './search-source.repository';
import { SearchMetricsAdapter } from '../metrics/search-metrics.adapter';

const TRANSACTION_OPTIONS = { maxWait: 5000, timeout: 90000 };
@Injectable()
export class SearchIndexCoordinator implements SearchAdminPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly source: SearchSourceRepository,
    private readonly metrics: SearchMetricsAdapter,
    @Inject(searchConfig.KEY)
    private readonly config: ConfigType<typeof searchConfig>,
    @Inject(SEARCH_ENGINE_PORT) private readonly engine: SearchEnginePort,
  ) {}
  async rebuild() {
    if (!this.config.enabled)
      throw new ServiceUnavailableException({
        message: 'Meilisearch chưa được bật',
      });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(6090906)::text`;
      const state = await this.ensure(tx);
      if (state.phase !== 'IDLE') return state;
      return tx.searchIndexCheckpoint.update({
        where: { indexName: this.config.index },
        data: {
          phase: 'REQUESTED',
          cursor: null,
          totalDocuments: 0,
          lastError: null,
        },
      });
    }, TRANSACTION_OPTIONS);
  }
  async status() {
    const [checkpoint, pending, oldest] = await Promise.all([
      this.prisma.searchIndexCheckpoint.findUnique({
        where: { indexName: this.config.index },
      }),
      this.prisma.searchDirtyDocument.count(),
      this.prisma.searchDirtyDocument.findFirst({
        orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return {
      enabled: this.config.enabled,
      checkpoint,
      pendingDocuments: pending,
      indexingLagSeconds: oldest
        ? Math.max(0, (Date.now() - oldest.changedAt.getTime()) / 1000)
        : 0,
    };
  }

  /** One bounded, resumable batch. The DB lock serializes all replicas, not writes by readers/authors. */
  async tick(eventId?: string): Promise<void> {
    if (!this.config.enabled) return;
    let attemptedDocuments = 0;
    try {
      const oldest = await this.prisma.searchDirtyDocument.findFirst({
        orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
      });
      this.metrics.backlog(oldest?.changedAt ?? null);
      await this.prisma.$transaction(async (tx) => {
        const locks = await tx.$queryRaw<
          Array<{ locked: boolean }>
        >`SELECT pg_try_advisory_xact_lock(6090906) AS locked`;
        if (!locks[0]?.locked) return;
        let state = await this.ensure(tx);
        if (state.retiredIndex) {
          await this.engine.drop(state.retiredIndex);
          state = await tx.searchIndexCheckpoint.update({
            where: { indexName: state.indexName },
            data: { retiredIndex: null },
          });
        }
        if (state.phase === 'REQUESTED') {
          // Persist the name before creating/configuring externally. Retry reuses it.
          await tx.searchIndexCheckpoint.update({
            where: { indexName: state.indexName },
            data: {
              shadowIndex: `${state.indexName}_${randomUUID().replace(/-/gu, '')}`,
              phase: 'SCANNING',
              cursor: null,
              totalDocuments: 0,
            },
          });
          return;
        }
        if (state.phase === 'SCANNING' && state.shadowIndex) {
          if (!state.cursor) await this.engine.configure(state.shadowIndex);
          const docs = await this.source.batch(state.cursor, tx);
          attemptedDocuments = docs.length;
          await this.engine.upsert(state.shadowIndex, docs);
          await tx.searchIndexCheckpoint.update({
            where: { indexName: state.indexName },
            data: {
              cursor: docs.at(-1)?.id ?? state.cursor,
              totalDocuments: { increment: docs.length },
              ...(docs.length < 100 ? { phase: 'CATCHUP' } : {}),
              lastError: null,
            },
          });
        }

        const dirty = await tx.searchDirtyDocument.findMany({
          orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
          take: 25,
        });
        attemptedDocuments = dirty.length;
        this.metrics.backlog(dirty[0]?.changedAt ?? null);
        const docs = await this.source.documents(
          dirty.map((item) => item.id),
          tx,
        );
        const existing = new Set(docs.map((doc) => doc.id));
        const removed = dirty
          .filter((item) => !existing.has(item.id))
          .map((item) => item.id);
        // Incremental updates write to both generations until the pointer switches.
        for (const index of [state.activeIndex, state.shadowIndex].filter(
          (name): name is string => !!name,
        )) {
          await this.engine.upsert(index, docs);
          await this.engine.remove(index, removed);
        }
        for (const row of dirty) {
          await tx.searchDirtyDocument.deleteMany({
            where: { id: row.id, revision: row.revision },
          });
        }
        // A scan may overwrite a dual write only while holding the same lock;
        // source is read fresh, so older events never restore stale documents.
        if (
          state.phase === 'CATCHUP' &&
          state.shadowIndex &&
          (await tx.searchDirtyDocument.count()) === 0
        ) {
          await tx.searchIndexCheckpoint.update({
            where: { indexName: state.indexName },
            data: {
              activeIndex: state.shadowIndex,
              shadowIndex: null,
              retiredIndex: state.activeIndex,
              phase: 'IDLE',
              lastFullRebuildAt: new Date(),
              lastError: null,
            },
          });
        }
        if (dirty.length || eventId)
          await tx.searchIndexCheckpoint.update({
            where: { indexName: state.indexName },
            data: {
              lastProcessedAt: new Date(),
              ...(eventId ? { lastProcessedEventId: eventId } : {}),
              lastError: null,
            },
          });
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      this.metrics.failed(attemptedDocuments);
      await this.prisma.searchIndexCheckpoint.updateMany({
        where: { indexName: this.config.index },
        data: {
          lastError:
            'Indexing failed; the current index remains active. Check worker logs and engine availability.',
          failedDocuments: { increment: attemptedDocuments },
        },
      });
      throw error;
    }
  }
  private ensure(tx: Prisma.TransactionClient) {
    return tx.searchIndexCheckpoint.upsert({
      where: { indexName: this.config.index },
      create: { indexName: this.config.index },
      update: {},
    });
  }
}
