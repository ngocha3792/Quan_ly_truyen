import { randomUUID } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { isUuidV4 } from '@/common/utils/uuid.util';

import {
  hasFlag,
  readArgument,
  readPositiveInteger,
  requireArgument,
} from '../shared/script-arguments';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import type { ScriptLogger } from '../shared/script-logger';
import { runScript } from '../shared/script-runner';

/**
 * Imports chapters into an existing story through the public author API
 * (login -> resolve story -> create chapter -> optionally publish), instead
 * of writing to the database directly. This keeps slug generation, chapter
 * numbering, word counts and the draft/published state machine consistent
 * with what the application itself enforces.
 *
 * Usage (run from backend/):
 *   npx tsx scripts/tools/import-story-chapters.ts \
 *     --base-url=https://example.com \
 *     --identifier=author@example.com \
 *     --story=<story-slug-or-uuid> \
 *     --input=./chapters.txt \
 *     [--publish] [--dry-run] [--delay-ms=300] [--chapter-pattern=<regex>]
 *
 * Password: pass --password=... or, to avoid leaking it into shell history,
 * set the IMPORT_CHAPTERS_PASSWORD environment variable instead.
 *
 * Input: a single text file or a directory of text files. Chapters are
 * split on heading lines matching --chapter-pattern (default matches lines
 * starting with "Chương <number>" or "Chapter <number>", case-insensitive).
 * A file with no matching heading is imported as a single chapter titled
 * after the filename.
 */

const DEFAULT_HEADING_PATTERN = /^(Chương|Chapter)\s+\d+/iu;

interface ParsedChapter {
  readonly title: string;
  readonly content: string;
}

interface AuthorStorySummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

interface CreatedChapter {
  readonly id: string;
  readonly number: number;
  readonly status: string;
}

void runScript({
  name: 'import-story-chapters',

  async execute({ logger }) {
    const inputPath = requireArgument('input');
    const shouldPublish = hasFlag('publish');
    const isDryRun = hasFlag('dry-run');
    const delayMs = readPositiveInteger('delay-ms', 300);

    const patternSource = readArgument('chapter-pattern');
    const headingPattern = patternSource
      ? new RegExp(patternSource, 'iu')
      : DEFAULT_HEADING_PATTERN;

    const chapters = await loadChapters(inputPath, headingPattern, logger);

    if (chapters.length === 0) {
      throw new ScriptError(
        'Không phát hiện chương nào trong --input. Kiểm tra lại đường dẫn ' +
          'hoặc truyền --chapter-pattern phù hợp với định dạng tiêu đề.',
        ScriptExitCode.INVALID_ARGUMENT,
      );
    }

    for (const chapter of chapters) {
      if (chapter.title.length > 255) {
        throw new ScriptError(
          `Tiêu đề chương quá dài (>255 ký tự): "${chapter.title.slice(0, 60)}..."`,
          ScriptExitCode.INVALID_ARGUMENT,
        );
      }
    }

    logger.info(`Đã phát hiện ${chapters.length} chương`, {
      first: chapters[0]?.title,
      last: chapters.at(-1)?.title,
    });

    if (isDryRun) {
      chapters.forEach((chapter, index) => {
        logger.info(`[dry-run] #${index + 1} ${chapter.title}`, {
          contentLength: chapter.content.length,
        });
      });

      return;
    }

    // Only required once we're actually calling the API, so a --dry-run
    // parse check never needs production credentials.
    const baseUrl = requireArgument('base-url').replace(/\/+$/u, '');
    const identifier = requireArgument('identifier');
    const password =
      readArgument('password') ?? process.env.IMPORT_CHAPTERS_PASSWORD;

    if (!password) {
      throw new ScriptError(
        'Thiếu mật khẩu: truyền --password=... hoặc đặt biến môi trường ' +
          'IMPORT_CHAPTERS_PASSWORD (khuyến nghị dùng biến môi trường để ' +
          'không lộ mật khẩu vào lịch sử shell).',
        ScriptExitCode.INVALID_ARGUMENT,
      );
    }

    const storyReference = requireArgument('story');

    const accessToken = await login(baseUrl, identifier, password);
    const storyId = await resolveStoryId(
      baseUrl,
      accessToken,
      storyReference,
      logger,
    );

    let createdCount = 0;
    let publishedCount = 0;

    for (const [index, chapter] of chapters.entries()) {
      logger.info(
        `Đang tạo chương ${index + 1}/${chapters.length}: ${chapter.title}`,
      );

      const created = await createChapter(
        baseUrl,
        accessToken,
        storyId,
        chapter,
      );
      createdCount += 1;

      logger.info('Đã tạo chương', {
        chapterId: created.id,
        number: created.number,
        status: created.status,
      });

      if (shouldPublish) {
        await sleep(delayMs);

        const published = await publishChapter(
          baseUrl,
          accessToken,
          storyId,
          created.id,
        );
        publishedCount += 1;

        logger.info('Đã publish chương', {
          chapterId: published.id,
          status: published.status,
        });
      }

      await sleep(delayMs);
    }

    logger.info('Hoàn tất', {
      totalChapters: chapters.length,
      created: createdCount,
      published: publishedCount,
    });
  },
});

async function loadChapters(
  inputPath: string,
  headingPattern: RegExp,
  logger: ScriptLogger,
): Promise<ParsedChapter[]> {
  const stats = await stat(inputPath).catch(() => {
    throw new ScriptError(
      `Không đọc được --input="${inputPath}"`,
      ScriptExitCode.INVALID_ARGUMENT,
    );
  });

  const filePaths = stats.isDirectory()
    ? await listTextFiles(inputPath)
    : [inputPath];

  const chapters: ParsedChapter[] = [];

  for (const filePath of filePaths) {
    const text = await readFile(filePath, 'utf8');
    const parsed = parseChapters(text, headingPattern);

    if (parsed.chapters.length === 0) {
      const fallbackTitle = filenameToTitle(filePath);
      const content = text.trim();

      if (!content) {
        logger.warn('Bỏ qua file rỗng', { filePath });
        continue;
      }

      chapters.push({ title: fallbackTitle, content });
      continue;
    }

    if (parsed.preambleHasContent) {
      logger.warn(
        'Có nội dung trước tiêu đề chương đầu tiên đang bị bỏ qua, kiểm tra lại --chapter-pattern nếu không đúng ý',
        { filePath },
      );
    }

    chapters.push(...parsed.chapters);
  }

  return chapters;
}

async function listTextFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isFile() && ['.txt', '.md'].includes(extname(entry.name)),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => join(directoryPath, name));
}

function filenameToTitle(filePath: string): string {
  const base = filePath.split(/[/\\]/u).pop() ?? filePath;

  return base.replace(extname(base), '').trim();
}

function parseChapters(
  text: string,
  headingPattern: RegExp,
): { chapters: ParsedChapter[]; preambleHasContent: boolean } {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const chapters: ParsedChapter[] = [];

  let currentTitle: string | null = null;
  let currentLines: string[] = [];
  const preamble: string[] = [];

  const flush = () => {
    if (currentTitle === null) {
      return;
    }

    chapters.push({
      title: currentTitle,
      content: currentLines.join('\n').trim(),
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (headingPattern.test(trimmed)) {
      flush();
      currentTitle = trimmed;
      currentLines = [];
      continue;
    }

    if (currentTitle === null) {
      preamble.push(line);
    } else {
      currentLines.push(line);
    }
  }

  flush();

  return {
    chapters,
    preambleHasContent: preamble.join('').trim().length > 0,
  };
}

async function login(
  baseUrl: string,
  identifier: string,
  password: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new ScriptError(
      `Đăng nhập thất bại (HTTP ${response.status}): ${describeApiError(body)}`,
      ScriptExitCode.EXECUTION_ERROR,
    );
  }

  const accessToken = (body as { data?: { accessToken?: unknown } })?.data
    ?.accessToken;

  if (typeof accessToken !== 'string' || !accessToken) {
    throw new ScriptError(
      'Phản hồi đăng nhập không chứa accessToken.',
      ScriptExitCode.EXECUTION_ERROR,
    );
  }

  return accessToken;
}

async function resolveStoryId(
  baseUrl: string,
  accessToken: string,
  storyReference: string,
  logger: ScriptLogger,
): Promise<string> {
  const isDirectStoryId: boolean = isUuidV4(storyReference);

  if (isDirectStoryId) {
    return storyReference;
  }

  const response = await fetch(`${baseUrl}/api/v1/author/stories`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new ScriptError(
      `Không lấy được danh sách truyện của tác giả (HTTP ${response.status}): ${describeApiError(body)}`,
      ScriptExitCode.EXECUTION_ERROR,
    );
  }

  const stories: AuthorStorySummary[] =
    (body as { data?: AuthorStorySummary[] })?.data ?? [];

  const match = stories.find(
    (story) => story.slug === storyReference || story.id === storyReference,
  );

  if (!match) {
    const available = stories
      .map((story) => `${story.slug} (${story.title})`)
      .join(', ');

    throw new ScriptError(
      `Không tìm thấy truyện với slug/id "${storyReference}". ` +
        `Truyện thuộc tài khoản này: ${available || '(không có)'}`,
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  logger.info('Đã xác định truyện', {
    storyId: match.id,
    slug: match.slug,
    title: match.title,
  });

  return match.id;
}

async function createChapter(
  baseUrl: string,
  accessToken: string,
  storyId: string,
  chapter: ParsedChapter,
): Promise<CreatedChapter> {
  const response = await fetch(
    `${baseUrl}/api/v1/author/stories/${storyId}/chapters`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
        'x-idempotency-key': randomUUID(),
      },
      body: JSON.stringify({
        title: chapter.title,
        content: chapter.content,
      }),
    },
  );

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new ScriptError(
      `Tạo chương "${chapter.title}" thất bại (HTTP ${response.status}): ${describeApiError(body)}`,
      ScriptExitCode.EXECUTION_ERROR,
    );
  }

  return (body as { data: CreatedChapter }).data;
}

async function publishChapter(
  baseUrl: string,
  accessToken: string,
  storyId: string,
  chapterId: string,
): Promise<CreatedChapter> {
  const response = await fetch(
    `${baseUrl}/api/v1/author/stories/${storyId}/chapters/${chapterId}/publish`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-idempotency-key': randomUUID(),
      },
    },
  );

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new ScriptError(
      `Publish chương ${chapterId} thất bại (HTTP ${response.status}): ${describeApiError(body)}`,
      ScriptExitCode.EXECUTION_ERROR,
    );
  }

  return (body as { data: CreatedChapter }).data;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describeApiError(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = (body as { error?: { code?: string; message?: string } })
      .error;

    if (error?.message) {
      return `${error.code ?? 'ERROR'}: ${error.message}`;
    }
  }

  return typeof body === 'string' ? body : JSON.stringify(body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
