import { Injectable } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

import type {
  OcrCompletedPage,
  OcrPageRecord,
  OcrPendingPage,
  OcrPersistencePort,
} from '../../application';
import type { OcrLine } from '../../domain';

@Injectable()
export class PrismaOcrPersistence implements OcrPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async chapterExists(chapterId: string): Promise<boolean> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true },
    });
    return chapter !== null;
  }

  async requestChapter(input: {
    chapterId: string;
    language: string;
    requestedById: string;
  }): Promise<number> {
    const pages = await this.prisma.chapterMedia.findMany({
      where: { chapterId: input.chapterId },
      select: { mediaAssetId: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (pages.length === 0) return 0;

    // Re-requesting a chapter resets the previous attempt rather than adding a
    // second row, because the unique key is (chapter, page, language).
    await this.prisma.$transaction(
      pages.map((page) =>
        this.prisma.chapterMediaOcr.upsert({
          where: {
            chapterId_mediaAssetId_language: {
              chapterId: input.chapterId,
              mediaAssetId: page.mediaAssetId,
              language: input.language,
            },
          },
          create: {
            chapterId: input.chapterId,
            mediaAssetId: page.mediaAssetId,
            language: input.language,
            requestedById: input.requestedById,
          },
          update: {
            status: 'PENDING',
            text: null,
            lines: Prisma.DbNull,
            lineCount: 0,
            failureReason: null,
            completedAt: null,
            requestedById: input.requestedById,
          },
        }),
      ),
    );

    return pages.length;
  }

  async claimChapter(
    chapterId: string,
    language: string,
  ): Promise<readonly OcrPendingPage[]> {
    await this.prisma.chapterMediaOcr.updateMany({
      where: { chapterId, language, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });

    const rows = await this.prisma.chapterMediaOcr.findMany({
      where: { chapterId, language, status: 'PROCESSING' },
      select: {
        mediaAssetId: true,
        chapterMedia: {
          select: {
            sortOrder: true,
            mediaAsset: { select: { publicId: true } },
          },
        },
      },
      orderBy: { chapterMedia: { sortOrder: 'asc' } },
    });

    return rows
      .filter((row) => Boolean(row.chapterMedia.mediaAsset.publicId))
      .map((row) => ({
        mediaAssetId: row.mediaAssetId,
        publicId: row.chapterMedia.mediaAsset.publicId ?? '',
        sortOrder: row.chapterMedia.sortOrder,
      }));
  }

  async saveCompleted(
    chapterId: string,
    language: string,
    pages: readonly OcrCompletedPage[],
  ): Promise<void> {
    if (pages.length === 0) return;

    const completedAt = new Date();
    await this.prisma.$transaction(
      pages.map((page) =>
        this.prisma.chapterMediaOcr.update({
          where: {
            chapterId_mediaAssetId_language: {
              chapterId,
              mediaAssetId: page.mediaAssetId,
              language,
            },
          },
          data: {
            status: 'COMPLETED',
            text: page.text,
            lines: page.lines as unknown as Prisma.InputJsonValue,
            lineCount: page.lines.length,
            failureReason: null,
            completedAt,
          },
        }),
      ),
    );
  }

  async markFailed(
    chapterId: string,
    language: string,
    mediaAssetIds: readonly string[],
    reason: string,
  ): Promise<void> {
    if (mediaAssetIds.length === 0) return;

    await this.prisma.chapterMediaOcr.updateMany({
      where: { chapterId, language, mediaAssetId: { in: [...mediaAssetIds] } },
      data: { status: 'FAILED', failureReason: reason.slice(0, 1_000) },
    });
  }

  async listChapter(
    chapterId: string,
    language: string,
  ): Promise<readonly OcrPageRecord[]> {
    const rows = await this.prisma.chapterMediaOcr.findMany({
      where: { chapterId, language },
      select: {
        mediaAssetId: true,
        language: true,
        status: true,
        text: true,
        lines: true,
        lineCount: true,
        failureReason: true,
        completedAt: true,
        chapterMedia: { select: { sortOrder: true } },
      },
      orderBy: { chapterMedia: { sortOrder: 'asc' } },
    });

    return rows.map((row) => ({
      mediaAssetId: row.mediaAssetId,
      sortOrder: row.chapterMedia.sortOrder,
      language: row.language,
      status: row.status,
      text: row.text,
      lines: toLines(row.lines),
      lineCount: row.lineCount,
      failureReason: row.failureReason,
      completedAt: row.completedAt,
    }));
  }
}

function toLines(value: unknown): readonly OcrLine[] {
  return Array.isArray(value) ? (value as OcrLine[]) : [];
}
