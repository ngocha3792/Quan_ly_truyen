import { createHash, randomUUID } from 'node:crypto';

export const CHAPTER_CONTENT_DOCUMENT_SCHEMA_VERSION = 1 as const;

export type ChapterContentBlockType =
  'paragraph' | 'heading' | 'blockquote' | 'list' | 'code' | 'horizontal_rule';

export interface ChapterContentMark {
  readonly type: 'bold' | 'italic' | 'code' | 'link';
  readonly from: number;
  readonly to: number;
  readonly href?: string;
}

export interface ChapterContentBlock {
  readonly id: string;
  readonly type: ChapterContentBlockType;
  /** Lossless Markdown source for this block in schema v1. */
  readonly text: string;
  readonly marks: readonly ChapterContentMark[];
}

export interface ChapterContentDocument {
  readonly schemaVersion: typeof CHAPTER_CONTENT_DOCUMENT_SCHEMA_VERSION;
  readonly blocks: readonly ChapterContentBlock[];
}

interface ParsedBlock {
  readonly type: ChapterContentBlockType;
  readonly text: string;
  readonly marks: readonly ChapterContentMark[];
}

/**
 * Converts legacy Markdown into the canonical block document. Exact blocks are
 * aligned first; edited blocks retain a previous ID by semantic type and order
 * when an exact match is not available.
 */
export function createChapterContentDocument(
  markdown: string,
  previous?: ChapterContentDocument | null,
  createId: () => string = randomUUID,
): ChapterContentDocument {
  const nextBlocks = parseMarkdownBlocks(markdown);
  const previousBlocks = previous?.blocks ?? [];
  const ids = reconcileBlockIds(previousBlocks, nextBlocks);

  return {
    schemaVersion: CHAPTER_CONTENT_DOCUMENT_SCHEMA_VERSION,
    blocks: nextBlocks.map((block, index) => ({
      id: ids[index] ?? createId(),
      ...block,
    })),
  };
}

/** Deterministic fallback matching the migration's chapter+ordinal strategy. */
export function createBackfilledChapterContentDocument(
  markdown: string,
  chapterId: string,
): ChapterContentDocument {
  let blockIndex = 0;
  return createChapterContentDocument(markdown, null, () => {
    blockIndex += 1;
    const seed = `chapter:${chapterId}:${blockIndex}`;
    const hash = createHash('md5').update(seed).digest('hex').split('');
    hash[12] = '4';
    hash[16] = '8';
    const value = hash.join('');
    return [
      value.slice(0, 8),
      value.slice(8, 12),
      value.slice(12, 16),
      value.slice(16, 20),
      value.slice(20),
    ].join('-');
  });
}

export function isChapterContentDocument(
  value: unknown,
): value is ChapterContentDocument {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (!Array.isArray(value.blocks)) return false;

  const ids = new Set<string>();
  for (const block of value.blocks) {
    if (
      !isRecord(block) ||
      typeof block.id !== 'string' ||
      !UUID_PATTERN.test(block.id) ||
      !CONTENT_BLOCK_TYPES.has(block.type as ChapterContentBlockType) ||
      typeof block.text !== 'string' ||
      !Array.isArray(block.marks) ||
      ids.has(block.id)
    ) {
      return false;
    }
    const textLength = block.text.length;
    if (!block.marks.every((mark) => isValidMark(mark, textLength))) {
      return false;
    }
    ids.add(block.id);
  }

  return true;
}

function isValidMark(value: unknown, textLength: number): boolean {
  if (
    !isRecord(value) ||
    !CONTENT_MARK_TYPES.has(value.type as ChapterContentMark['type']) ||
    !Number.isInteger(value.from) ||
    !Number.isInteger(value.to) ||
    (value.from as number) < 0 ||
    (value.to as number) <= (value.from as number) ||
    (value.to as number) > textLength
  ) {
    return false;
  }

  return value.type === 'link'
    ? typeof value.href === 'string' && value.href.length > 0
    : value.href === undefined;
}

function parseMarkdownBlocks(markdown: string): readonly ParsedBlock[] {
  const normalized = markdown.replace(/\r\n?/gu, '\n').trim();
  if (!normalized) return [];

  const rawBlocks: string[] = [];
  let lines: string[] = [];
  let inFence = false;
  const flush = (): void => {
    const text = lines.join('\n').trim();
    if (text) rawBlocks.push(text);
    lines = [];
  };

  for (const line of normalized.split('\n')) {
    if (inFence) {
      lines.push(line);
      if (/^```[\t ]*$/u.test(line)) inFence = false;
      continue;
    }
    if (/^```/u.test(line)) {
      lines.push(line);
      inFence = true;
      continue;
    }
    if (/^[\t ]*$/u.test(line)) {
      flush();
      continue;
    }
    lines.push(line);
  }
  flush();

  return rawBlocks.map((text) => ({
    type: inferBlockType(text),
    text,
    marks: [],
  }));
}

function inferBlockType(text: string): ChapterContentBlockType {
  if (/^```/u.test(text)) return 'code';
  if (/^#{1,6}[\t ]+/u.test(text)) return 'heading';
  if (/^>[\t ]?/u.test(text)) return 'blockquote';
  if (/^(?:[-+*]|\d+[.)])[\t ]+/u.test(text)) return 'list';
  if (/^(?:-{3,}|_{3,}|\*{3,})$/u.test(text)) return 'horizontal_rule';
  return 'paragraph';
}

function reconcileBlockIds(
  previous: readonly ChapterContentBlock[],
  next: readonly ParsedBlock[],
): Array<string | undefined> {
  const ids: Array<string | undefined> = Array.from({ length: next.length });
  const usedPrevious = new Set<number>();
  const exactQueues = new Map<string, number[]>();

  previous.forEach((block, index) => {
    const key = blockKey(block);
    const queue = exactQueues.get(key) ?? [];
    queue.push(index);
    exactQueues.set(key, queue);
  });

  // Exact blocks keep their IDs even when blocks are inserted around them.
  next.forEach((block, index) => {
    const previousIndex = exactQueues.get(blockKey(block))?.shift();
    if (previousIndex === undefined) return;
    ids[index] = previous[previousIndex]?.id;
    usedPrevious.add(previousIndex);
  });

  // Match edited blocks before positional fallback. This prevents an inserted
  // same-type block from stealing the ID of a nearby paragraph that was edited.
  const candidates: BlockMatchCandidate[] = [];
  previous.forEach((previousBlock, previousIndex) => {
    if (usedPrevious.has(previousIndex)) return;
    next.forEach((nextBlock, nextIndex) => {
      if (ids[nextIndex] || previousBlock.type !== nextBlock.type) return;
      candidates.push({
        previousIndex,
        nextIndex,
        similarity: textSimilarity(previousBlock.text, nextBlock.text),
        distance: Math.abs(previousIndex - nextIndex),
      });
    });
  });
  candidates
    .sort(
      (left, right) =>
        right.similarity - left.similarity || left.distance - right.distance,
    )
    .forEach((candidate) => {
      if (
        candidate.similarity < EDITED_BLOCK_SIMILARITY_THRESHOLD ||
        usedPrevious.has(candidate.previousIndex) ||
        ids[candidate.nextIndex]
      ) {
        return;
      }
      ids[candidate.nextIndex] = previous[candidate.previousIndex]?.id;
      usedPrevious.add(candidate.previousIndex);
    });

  // A one-for-one unmatched span is treated as a complete rewrite in place.
  for (const type of CONTENT_BLOCK_TYPES) {
    const previousIndexes = previous
      .map((block, index) => ({ block, index }))
      .filter(
        ({ block, index }) => block.type === type && !usedPrevious.has(index),
      )
      .map(({ index }) => index);
    const nextIndexes = next
      .map((block, index) => ({ block, index }))
      .filter(({ block, index }) => block.type === type && !ids[index])
      .map(({ index }) => index);
    if (previousIndexes.length !== nextIndexes.length) continue;
    nextIndexes.forEach((nextIndex, index) => {
      const previousIndex = previousIndexes[index];
      if (previousIndex === undefined) return;
      ids[nextIndex] = previous[previousIndex]?.id;
    });
  }

  return ids;
}

interface BlockMatchCandidate {
  readonly previousIndex: number;
  readonly nextIndex: number;
  readonly similarity: number;
  readonly distance: number;
}

function textSimilarity(left: string, right: string): number {
  const leftPairs = characterPairs(normalizeComparableText(left));
  const rightPairs = characterPairs(normalizeComparableText(right));
  if (leftPairs.size === 0 || rightPairs.size === 0) {
    return left.trim() === right.trim() ? 1 : 0;
  }
  let intersection = 0;
  for (const pair of leftPairs) {
    if (rightPairs.has(pair)) intersection += 1;
  }
  return (2 * intersection) / (leftPairs.size + rightPairs.size);
}

function normalizeComparableText(value: string): string {
  return value.toLocaleLowerCase('vi').replace(/\s+/gu, ' ').trim();
}

function characterPairs(value: string): ReadonlySet<string> {
  const pairs = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) {
    pairs.add(value.slice(index, index + 2));
  }
  return pairs;
}

function blockKey(block: Pick<ChapterContentBlock, 'type' | 'text'>): string {
  return `${block.type}\u0000${block.text}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const CONTENT_BLOCK_TYPES = new Set<ChapterContentBlockType>([
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'code',
  'horizontal_rule',
]);

const CONTENT_MARK_TYPES = new Set<ChapterContentMark['type']>([
  'bold',
  'italic',
  'code',
  'link',
]);

const EDITED_BLOCK_SIMILARITY_THRESHOLD = 0.25;
