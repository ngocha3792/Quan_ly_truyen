import type { Chapter, Prisma } from '@/generated/prisma/client';
import type { ChapterRecord } from '../../application/ports/chapter.persistence.port';
import {
  createBackfilledChapterContentDocument,
  isChapterContentDocument,
} from '../../domain';

export function workflowChapterRecord(row: Chapter): ChapterRecord {
  const document = isChapterContentDocument(row.contentDocument)
    ? row.contentDocument
    : createBackfilledChapterContentDocument(row.content, row.id);
  return {
    ...row,
    number: row.number.toNumber(),
    contentDocument: document,
    documentSchemaVersion: document.schemaVersion,
  };
}

export function workflowSnapshot(
  row: Pick<
    Chapter,
    | 'id'
    | 'title'
    | 'content'
    | 'contentDocument'
    | 'contentFormat'
    | 'wordCount'
  >,
  userId: string,
  version: number,
  summary: string,
): Prisma.ChapterVersionUncheckedCreateWithoutChapterInput {
  const document = isChapterContentDocument(row.contentDocument)
    ? row.contentDocument
    : createBackfilledChapterContentDocument(row.content, row.id);
  return {
    createdById: userId,
    version,
    title: row.title,
    content: row.content,
    contentDocument: document as unknown as Prisma.InputJsonValue,
    documentSchemaVersion: document.schemaVersion,
    contentFormat: row.contentFormat,
    wordCount: row.wordCount,
    changeSummary: summary,
    versionType: 'MANUAL_SAVE',
    isRetained: true,
  };
}
