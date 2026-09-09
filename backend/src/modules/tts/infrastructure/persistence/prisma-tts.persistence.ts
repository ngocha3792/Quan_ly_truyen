import { Inject, Injectable } from '@nestjs/common';

import { AppException } from '@/common/exceptions';
import {
  ChapterAccessType,
  ChapterEntitlementStatus,
  ChapterPurchaseStatus,
  ChapterStatus,
  Prisma,
  StoryStatus,
  StoryVisibility,
  TtsFallbackPolicy,
  TtsManifestStatus,
  TtsSegmentStatus,
} from '@/generated/prisma/client';
import {
  PrismaService,
  mapPrismaError,
} from '@/infrastructure/database/prisma';
import { MEDIA_URL_BUILDER, type MediaUrlPort } from '@/modules/media';
import { isChapterContentDocument } from '@/modules/chapters';
import {
  TTS_PROVIDER_PORT,
  type CompleteTtsSegmentInput,
  type CreateTtsConnectionInput,
  type CreateTtsManifestInput,
  type TtsConnectionDto,
  type TtsGenerationConnection,
  type TtsGenerationWork,
  type TtsManifestDto,
  type TtsPersistencePort,
  type TtsProviderPort,
  type TtsQuotaDto,
  type TtsSegmentDto,
  type TtsWordTimingDto,
} from '../../application';
import {
  TtsChapterAccessDeniedException,
  TtsConnectionNotFoundException,
  TtsInvalidInputException,
  TtsManifestNotFoundException,
  TtsQuotaExceededException,
  normalizeTtsText,
  ttsStyleHash,
} from '../../domain';

const MANIFEST_SELECT = {
  id: true,
  chapterId: true,
  chapterVersion: true,
  language: true,
  voiceId: true,
  fallbackPolicy: true,
  status: true,
  totalSegments: true,
  completedSegments: true,
  characterCount: true,
  totalDurationMs: true,
  estimatedCostMicros: true,
  failureReason: true,
  createdAt: true,
  segments: {
    orderBy: { blockIndex: 'asc' as const },
    select: {
      id: true,
      blockId: true,
      blockIndex: true,
      status: true,
      audioPublicId: true,
      durationMs: true,
      startTimeMs: true,
      endTimeMs: true,
      wordTimings: true,
    },
  },
} satisfies Prisma.TtsManifestSelect;

@Injectable()
export class PrismaTtsPersistence implements TtsPersistencePort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_URL_BUILDER) private readonly mediaUrl: MediaUrlPort,
    @Inject(TTS_PROVIDER_PORT) private readonly provider: TtsProviderPort,
  ) {}

  async createConnection(
    input: CreateTtsConnectionInput,
  ): Promise<TtsConnectionDto> {
    try {
      const row = await this.prisma.ttsVoiceConnection.create({
        data: {
          userId: input.userId,
          isSystem: input.isSystem,
          provider: input.provider,
          name: input.name,
          voiceId: input.voiceId,
          voiceName: input.voiceName,
          language: input.language,
          encryptedApiKey: input.encryptedApiKey,
          stability: decimal(input.stability),
          similarity: decimal(input.similarity),
          style: decimal(input.style),
        },
      });
      return mapConnection(row);
    } catch (error) {
      rethrow(error, 'tts-create-connection');
    }
  }

  async listConnections(userId: string): Promise<readonly TtsConnectionDto[]> {
    const rows = await this.prisma.ttsVoiceConnection.findMany({
      where: { isActive: true, OR: [{ userId }, { isSystem: true }] },
      orderBy: [{ isSystem: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(mapConnection);
  }

  async deleteConnection(
    userId: string,
    connectionId: string,
    system: boolean,
  ): Promise<void> {
    const deleted = await this.prisma.ttsVoiceConnection.updateMany({
      where: system
        ? { id: connectionId, isSystem: true }
        : { id: connectionId, userId, isSystem: false },
      data: { isActive: false },
    });
    if (deleted.count !== 1)
      throw new TtsConnectionNotFoundException(connectionId);
  }

  async createOrGetManifest(
    input: CreateTtsManifestInput,
  ): Promise<{ manifest: TtsManifestDto; created: boolean }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const connection = await tx.ttsVoiceConnection.findFirst({
          where: {
            id: input.connectionId,
            isActive: true,
            OR: [{ userId: input.userId, isSystem: false }, { isSystem: true }],
          },
        });
        if (!connection)
          throw new TtsConnectionNotFoundException(input.connectionId);
        if (
          connection.isSystem &&
          input.fallbackPolicy !== TtsFallbackPolicy.SYSTEM
        ) {
          throw new TtsInvalidInputException(
            'Phải chọn fallbackPolicy SYSTEM để dùng khóa hệ thống',
            'fallbackPolicy',
          );
        }

        const chapter = await loadAccessibleChapter(
          tx,
          input.userId,
          input.chapterId,
        );
        if (!chapter) throw new TtsChapterAccessDeniedException();
        if (!isChapterContentDocument(chapter.contentDocument)) {
          throw new TtsInvalidInputException(
            'Chương chưa có content document ổn định',
            'chapterId',
          );
        }
        const blocks = chapter.contentDocument.blocks
          .filter(
            (block) =>
              block.type !== 'horizontal_rule' && block.text.trim().length > 0,
          )
          .map((block, blockIndex) => ({
            blockId: block.id,
            blockIndex,
            blockText: normalizeTtsText(
              block.text,
              `blocks.${blockIndex}.text`,
            ),
          }));
        if (!blocks.length)
          throw new TtsInvalidInputException(
            'Chương không có nội dung để đọc',
            'chapterId',
          );
        const characterCount = blocks.reduce(
          (total, block) => total + block.blockText.length,
          0,
        );
        const styleHash = ttsStyleHash({
          stability: numberOrNull(connection.stability),
          similarity: numberOrNull(connection.similarity),
          style: numberOrNull(connection.style),
        });
        const cacheKey = {
          userId_chapterId_chapterVersion_language_voiceId_styleHash: {
            userId: input.userId,
            chapterId: chapter.id,
            chapterVersion: chapter.version,
            language: input.language,
            voiceId: connection.voiceId,
            styleHash,
          },
        };
        const existing = await tx.ttsManifest.findUnique({
          where: cacheKey,
          select: MANIFEST_SELECT,
        });
        if (existing && existing.status !== TtsManifestStatus.FAILED) {
          await tx.ttsManifest.update({
            where: { id: existing.id },
            data: { lastAccessedAt: input.now },
          });
          return { row: existing, created: false };
        }

        const quota = await lockAndRefreshQuota(tx, input.userId, input.now);
        if (
          quota.currentMonthUsage + quota.reservedCharacters + characterCount >
          quota.monthlyCharacterLimit
        ) {
          throw new TtsQuotaExceededException(
            quota.monthlyCharacterLimit,
            quota.currentMonthUsage + quota.reservedCharacters,
          );
        }
        const reserved = await tx.ttsQuota.updateMany({
          where: {
            userId: input.userId,
            currentMonthUsage: {
              lte:
                quota.monthlyCharacterLimit -
                quota.reservedCharacters -
                characterCount,
            },
          },
          data: { reservedCharacters: { increment: characterCount } },
        });
        if (reserved.count !== 1)
          throw new TtsQuotaExceededException(
            quota.monthlyCharacterLimit,
            quota.currentMonthUsage + quota.reservedCharacters,
          );

        if (existing) {
          await tx.ttsSegment.updateMany({
            where: { manifestId: existing.id },
            data: {
              status: TtsSegmentStatus.PENDING,
              failureReason: null,
              retryCount: { increment: 1 },
            },
          });
          const row = await tx.ttsManifest.update({
            where: { id: existing.id },
            data: {
              connectionId: connection.id,
              fallbackPolicy: input.fallbackPolicy,
              status: TtsManifestStatus.PENDING,
              completedSegments: 0,
              totalDurationMs: null,
              failureReason: null,
              startedAt: null,
              completedAt: null,
              jobId: null,
              lastAccessedAt: input.now,
            },
            select: MANIFEST_SELECT,
          });
          return { row, created: true };
        }

        const row = await tx.ttsManifest.create({
          data: {
            userId: input.userId,
            chapterId: chapter.id,
            connectionId: connection.id,
            chapterVersion: chapter.version,
            language: input.language,
            voiceId: connection.voiceId,
            styleHash,
            fallbackPolicy: input.fallbackPolicy,
            totalSegments: blocks.length,
            characterCount,
            estimatedCostMicros:
              this.provider.estimateCostMicros(characterCount),
            lastAccessedAt: input.now,
            segments: {
              create: blocks.map((block) => ({
                ...block,
                characterCount: block.blockText.length,
              })),
            },
          },
          select: MANIFEST_SELECT,
        });
        return { row, created: true };
      }, transactionOptions());
      return {
        manifest: mapManifest(result.row, this.mediaUrl),
        created: result.created,
      };
    } catch (error) {
      rethrow(error, 'tts-create-manifest');
    }
  }

  async setManifestJobId(
    userId: string,
    manifestId: string,
    jobId: string,
  ): Promise<void> {
    const updated = await this.prisma.ttsManifest.updateMany({
      where: { id: manifestId, userId },
      data: { jobId },
    });
    if (updated.count !== 1) throw new TtsManifestNotFoundException(manifestId);
  }

  async getManifest(
    userId: string,
    manifestId: string,
    now: Date,
  ): Promise<TtsManifestDto> {
    const manifest = await this.prisma.ttsManifest.findFirst({
      where: { id: manifestId, userId },
      select: { ...MANIFEST_SELECT, chapterId: true },
    });
    if (!manifest) throw new TtsManifestNotFoundException(manifestId);
    if (
      !(await loadAccessibleChapter(this.prisma, userId, manifest.chapterId))
    ) {
      throw new TtsChapterAccessDeniedException();
    }
    await this.prisma.ttsManifest.update({
      where: { id: manifestId },
      data: { lastAccessedAt: now },
    });
    return mapManifest(manifest, this.mediaUrl);
  }

  async getQuota(userId: string, now: Date): Promise<TtsQuotaDto> {
    const quota = await this.prisma.$transaction(
      (tx) => lockAndRefreshQuota(tx, userId, now),
      transactionOptions(),
    );
    return mapQuota(quota);
  }

  async claimGeneration(
    manifestId: string,
    now: Date,
  ): Promise<TtsGenerationWork | null> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.ttsManifest.updateMany({
        where: { id: manifestId, status: TtsManifestStatus.PENDING },
        data: {
          status: TtsManifestStatus.PROCESSING,
          startedAt: now,
          failureReason: null,
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.ttsManifest.findUnique({
          where: { id: manifestId },
          select: { status: true },
        });
        if (current?.status !== TtsManifestStatus.PROCESSING) return null;
      }
      const row = await tx.ttsManifest.findUnique({
        where: { id: manifestId },
        include: {
          connection: true,
          segments: { orderBy: { blockIndex: 'asc' } },
        },
      });
      if (!row) return null;
      const fallback =
        row.fallbackPolicy === TtsFallbackPolicy.SYSTEM &&
        !row.connection.isSystem
          ? await tx.ttsVoiceConnection.findFirst({
              where: {
                isSystem: true,
                isActive: true,
                provider: row.connection.provider,
                voiceId: row.connection.voiceId,
                language: row.language,
                stability: row.connection.stability,
                similarity: row.connection.similarity,
                style: row.connection.style,
              },
              orderBy: { createdAt: 'asc' },
            })
          : null;
      return {
        manifestId: row.id,
        userId: row.userId,
        chapterId: row.chapterId,
        characterCount: row.characterCount,
        estimatedCostMicros: row.estimatedCostMicros,
        fallbackPolicy: row.fallbackPolicy,
        connection: mapGenerationConnection(row.connection),
        systemFallback: fallback ? mapGenerationConnection(fallback) : null,
        segments: row.segments.map((segment) => ({
          id: segment.id,
          blockText: segment.blockText,
          blockIndex: segment.blockIndex,
          characterCount: segment.characterCount,
          status: segment.status,
        })),
      };
    }, transactionOptions());
  }

  async completeSegment(input: CompleteTtsSegmentInput): Promise<void> {
    await this.prisma.ttsSegment.update({
      where: { id: input.segmentId },
      data: {
        status: TtsSegmentStatus.GENERATED,
        audioPublicId: input.audioPublicId,
        durationMs: input.durationMs,
        sizeBytes: input.sizeBytes,
        format: input.format,
        wordTimings:
          input.wordTimings === null
            ? Prisma.JsonNull
            : (input.wordTimings as Prisma.InputJsonValue),
        usedSystemFallback: input.usedSystemFallback,
        generatedAt: new Date(),
        failureReason: null,
      },
    });
  }

  async failSegment(segmentId: string, reason: string): Promise<void> {
    await this.prisma.ttsSegment.update({
      where: { id: segmentId },
      data: {
        status: TtsSegmentStatus.FAILED,
        failureReason: reason.slice(0, 1_000),
        retryCount: { increment: 1 },
      },
    });
  }

  async completeManifest(manifestId: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const manifest = await tx.ttsManifest.findUnique({
        where: { id: manifestId },
        include: {
          connection: true,
          segments: { orderBy: { blockIndex: 'asc' } },
          usage: true,
        },
      });
      if (!manifest || manifest.status === TtsManifestStatus.COMPLETED) return;
      if (
        manifest.segments.some(
          (segment) =>
            segment.status !== TtsSegmentStatus.GENERATED ||
            segment.durationMs === null,
        )
      ) {
        throw new TtsInvalidInputException(
          'Không thể hoàn tất manifest khi còn segment chưa tạo',
        );
      }
      let cursor = 0;
      for (const segment of manifest.segments) {
        const duration = segment.durationMs ?? 0;
        await tx.ttsSegment.update({
          where: { id: segment.id },
          data: { startTimeMs: cursor, endTimeMs: cursor + duration },
        });
        cursor += duration;
      }
      if (!manifest.usage) {
        await tx.ttsUsage.create({
          data: {
            userId: manifest.userId,
            connectionId: manifest.connectionId,
            manifestId: manifest.id,
            provider: manifest.connection.provider,
            characterCount: manifest.characterCount,
            segmentCount: manifest.totalSegments,
            totalDurationMs: cursor,
            estimatedCostMicros: manifest.estimatedCostMicros,
          },
        });
        await tx.ttsQuota.update({
          where: { userId: manifest.userId },
          data: {
            reservedCharacters: { decrement: manifest.characterCount },
            currentMonthUsage: { increment: manifest.characterCount },
            totalCharacters: { increment: manifest.characterCount },
            totalSegments: { increment: manifest.totalSegments },
          },
        });
      }
      await tx.ttsManifest.update({
        where: { id: manifest.id },
        data: {
          status: TtsManifestStatus.COMPLETED,
          completedSegments: manifest.totalSegments,
          totalDurationMs: cursor,
          completedAt: now,
        },
      });
    }, transactionOptions());
  }

  async failManifest(
    manifestId: string,
    reason: string,
    now: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const manifest = await tx.ttsManifest.findUnique({
        where: { id: manifestId },
        select: { userId: true, characterCount: true, status: true },
      });
      if (
        !manifest ||
        manifest.status === TtsManifestStatus.COMPLETED ||
        manifest.status === TtsManifestStatus.FAILED
      )
        return;
      await tx.ttsManifest.update({
        where: { id: manifestId },
        data: {
          status: TtsManifestStatus.FAILED,
          failureReason: reason.slice(0, 1_000),
          completedAt: now,
        },
      });
      await tx.ttsQuota.updateMany({
        where: {
          userId: manifest.userId,
          reservedCharacters: { gte: manifest.characterCount },
        },
        data: { reservedCharacters: { decrement: manifest.characterCount } },
      });
    }, transactionOptions());
  }
}

async function loadAccessibleChapter(
  tx: Prisma.TransactionClient | PrismaService,
  userId: string,
  chapterId: string,
) {
  const chapter = await tx.chapter.findFirst({
    where: {
      id: chapterId,
      status: ChapterStatus.PUBLISHED,
      publishedAt: { not: null },
      deletedAt: null,
      story: {
        visibility: StoryVisibility.PUBLIC,
        status: {
          in: [
            StoryStatus.PUBLISHED,
            StoryStatus.HIATUS,
            StoryStatus.COMPLETED,
          ],
        },
        publishedAt: { not: null },
        deletedAt: null,
      },
    },
    select: {
      id: true,
      version: true,
      contentDocument: true,
      monetization: { select: { accessType: true } },
      entitlements: {
        where: { userId, status: ChapterEntitlementStatus.ACTIVE },
        select: { purchase: { select: { status: true } } },
        take: 1,
      },
    },
  });
  if (!chapter) return null;
  const paid = chapter.monetization?.accessType === ChapterAccessType.PAID;
  return !paid ||
    chapter.entitlements[0]?.purchase.status === ChapterPurchaseStatus.COMPLETED
    ? chapter
    : null;
}

async function lockAndRefreshQuota(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
) {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  await tx.ttsQuota.upsert({
    where: { userId },
    create: { userId, currentMonthStart: monthStart },
    update: {},
  });
  await tx.$queryRaw(
    Prisma.sql`SELECT "user_id" FROM "tts_quotas" WHERE "user_id" = ${userId}::uuid FOR UPDATE`,
  );
  const current = await tx.ttsQuota.findUniqueOrThrow({ where: { userId } });
  if (current.currentMonthStart < monthStart) {
    return tx.ttsQuota.update({
      where: { userId },
      data: {
        currentMonthStart: monthStart,
        currentMonthUsage: 0,
        reservedCharacters: 0,
      },
    });
  }
  return current;
}

function mapConnection(
  row: Prisma.TtsVoiceConnectionGetPayload<object>,
): TtsConnectionDto {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    voiceId: row.voiceId,
    voiceName: row.voiceName,
    language: row.language,
    stability: numberOrNull(row.stability),
    similarity: numberOrNull(row.similarity),
    style: numberOrNull(row.style),
    isSystem: row.isSystem,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function mapGenerationConnection(
  row: Prisma.TtsVoiceConnectionGetPayload<object>,
): TtsGenerationConnection {
  return {
    id: row.id,
    encryptedApiKey: row.encryptedApiKey,
    provider: row.provider,
    voiceId: row.voiceId,
    language: row.language,
    stability: numberOrNull(row.stability),
    similarity: numberOrNull(row.similarity),
    style: numberOrNull(row.style),
  };
}

function mapManifest(
  row: Prisma.TtsManifestGetPayload<{ select: typeof MANIFEST_SELECT }>,
  mediaUrl: MediaUrlPort,
): TtsManifestDto {
  return {
    id: row.id,
    chapterId: row.chapterId,
    chapterVersion: row.chapterVersion,
    language: row.language,
    voiceId: row.voiceId,
    fallbackPolicy: row.fallbackPolicy,
    status: row.status,
    totalSegments: row.totalSegments,
    completedSegments: row.completedSegments,
    characterCount: row.characterCount,
    totalDurationMs: row.totalDurationMs,
    estimatedCostMicros: row.estimatedCostMicros?.toString() ?? null,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    segments: row.segments.map((segment) => mapSegment(segment, mediaUrl)),
  };
}

function mapSegment(
  segment: Prisma.TtsSegmentGetPayload<{
    select: (typeof MANIFEST_SELECT)['segments']['select'];
  }>,
  mediaUrl: MediaUrlPort,
): TtsSegmentDto {
  return {
    id: segment.id,
    blockId: segment.blockId,
    blockIndex: segment.blockIndex,
    status: segment.status,
    audioUrl: segment.audioPublicId
      ? mediaUrl.build({
          publicId: segment.audioPublicId,
          resourceType: 'video',
          preset: 'ttsAudio',
        })
      : null,
    durationMs: segment.durationMs,
    startTimeMs: segment.startTimeMs,
    endTimeMs: segment.endTimeMs,
    wordTimings: parseWordTimings(segment.wordTimings),
  };
}

function parseWordTimings(value: unknown): readonly TtsWordTimingDto[] | null {
  if (!Array.isArray(value)) return null;
  const result = value.filter(
    (item): item is TtsWordTimingDto =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as TtsWordTimingDto).word === 'string' &&
      Number.isInteger((item as TtsWordTimingDto).startMs) &&
      Number.isInteger((item as TtsWordTimingDto).endMs),
  );
  return result.length === value.length ? result : null;
}

function mapQuota(quota: Prisma.TtsQuotaGetPayload<object>): TtsQuotaDto {
  return {
    monthlyCharacterLimit: quota.monthlyCharacterLimit,
    currentMonthUsage: quota.currentMonthUsage,
    reservedCharacters: quota.reservedCharacters,
    remainingCharacters: Math.max(
      0,
      quota.monthlyCharacterLimit -
        quota.currentMonthUsage -
        quota.reservedCharacters,
    ),
    currentMonthStart: quota.currentMonthStart,
    totalCharacters: quota.totalCharacters.toString(),
    totalSegments: quota.totalSegments,
  };
}

function numberOrNull(value: Prisma.Decimal | null): number | null {
  return value?.toNumber() ?? null;
}

function decimal(value: number | null): Prisma.Decimal | undefined {
  return value === null ? undefined : new Prisma.Decimal(value);
}

function transactionOptions() {
  return {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 30_000,
  } as const;
}

function rethrow(error: unknown, operation: string): never {
  if (error instanceof AppException) throw error;
  throw mapPrismaError(error, { operation, resource: 'TTS' });
}
