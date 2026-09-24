/**
 * One-off fix: corrects "Chương Sáu" of "Yashiro-kun's Guide to Going Solo"
 * (chapter id 141cb34c-68a3-40a3-b4b5-33285585ec7b), which absorbed 5 later
 * chapters' worth of text due to a parser bug (now fixed) that didn't
 * recognize "Chương Cuối" / "Chương Bí mật N" headings. Those 5 chapters
 * have already been correctly re-published separately; this just trims the
 * duplicated tail back out of chapter 6 itself.
 *
 * Place this file (and its sibling chuong-6-corrected-content.txt) at
 * backend/scripts/tools/ in the actual deployed checkout, then run from the
 * backend/ directory so the Prisma client + DATABASE_URL + "@/" path alias
 * all resolve against the live database:
 *
 *   npx tsx scripts/tools/fix-chapter-6-content.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createScriptPrismaClient } from '../shared/prisma-client';
import { Prisma } from '@/generated/prisma/client';
import { countChapterWords } from '@/modules/chapters/domain/value-objects/chapter-fields.value-object';
import { createBackfilledChapterContentDocument } from '@/modules/chapters/domain/value-objects/chapter-content-document.value-object';

const CHAPTER_ID = '141cb34c-68a3-40a3-b4b5-33285585ec7b';

async function main() {
  const correctedContent = readFileSync(
    path.join(__dirname, 'chuong-6-corrected-content.txt'),
    'utf8',
  );

  const prisma = createScriptPrismaClient();
  try {
    const current = await prisma.chapter.findUniqueOrThrow({
      where: { id: CHAPTER_ID },
      select: {
        id: true,
        title: true,
        version: true,
        status: true,
        content: true,
      },
    });

    console.log(
      `Trước khi sửa: "${current.title}" (${current.content.length} ký tự, version ${current.version}, status ${current.status})`,
    );

    if (current.status !== 'PUBLISHED') {
      throw new Error(
        `Chương đang ở trạng thái ${current.status}, không phải PUBLISHED — dừng lại để kiểm tra thủ công.`,
      );
    }

    const wordCount = countChapterWords(correctedContent);
    const contentDocument = createBackfilledChapterContentDocument(
      correctedContent,
      CHAPTER_ID,
    );

    const updated = await prisma.chapter.update({
      where: { id: CHAPTER_ID },
      data: {
        content: correctedContent,
        contentDocument: contentDocument as unknown as Prisma.InputJsonValue,
        wordCount,
        version: { increment: 1 },
      },
      select: {
        id: true,
        title: true,
        version: true,
        wordCount: true,
        content: true,
      },
    });

    console.log(
      `Sau khi sửa: "${updated.title}" (${updated.content.length} ký tự, ${updated.wordCount} từ, version ${updated.version})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('LỖI:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
