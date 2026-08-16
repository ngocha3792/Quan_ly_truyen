import 'dotenv/config';
import { createScriptPrismaClient } from '../shared/prisma-client';

const prisma = createScriptPrismaClient();
const apply = process.argv.includes('--apply');
const from = option('--from');
const to = option('--to');
const timeZone = process.env.ANALYTICS_TIME_ZONE ?? 'Asia/Ho_Chi_Minh';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const sessions = await prisma.readingSession.findMany({
    where: {
      ...(from || to
        ? {
            startedAt: {
              ...(from
                ? { gte: new Date(new Date(`${from}T00:00:00.000Z`).getTime() - 86_400_000) }
                : {}),
              ...(to
                ? { lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 2 * 86_400_000) }
                : {}),
            },
          }
        : {}),
    },
    select: { userId: true, storyId: true, chapterId: true, startedAt: true, durationSeconds: true, completed: true },
    orderBy: { startedAt: 'asc' },
  });
  const byStory = new Map<string, { storyId: string; date: Date; starts: number; completions: number; seconds: bigint; readers: Set<string> }>();
  const byChapter = new Map<string, { chapterId: string; date: Date; starts: number; completions: number; seconds: bigint; readers: Set<string> }>();
  for (const session of sessions) {
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(session.startedAt);
    if ((from && dateKey < from) || (to && dateKey > to)) continue;
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const storyKey = `${session.storyId}:${dateKey}`;
    const chapterKey = `${session.chapterId}:${dateKey}`;
    const duration = BigInt(Math.max(0, session.durationSeconds ?? 0));
    const story = byStory.get(storyKey) ?? { storyId: session.storyId, date, starts: 0, completions: 0, seconds: 0n, readers: new Set<string>() };
    story.starts += 1; story.completions += session.completed ? 1 : 0; story.seconds += duration; story.readers.add(session.userId); byStory.set(storyKey, story);
    const chapter = byChapter.get(chapterKey) ?? { chapterId: session.chapterId, date, starts: 0, completions: 0, seconds: 0n, readers: new Set<string>() };
    chapter.starts += 1; chapter.completions += session.completed ? 1 : 0; chapter.seconds += duration; chapter.readers.add(session.userId); byChapter.set(chapterKey, chapter);
  }
  console.log(`Reading sessions found: ${sessions.length}`);
  console.log(`Story daily rows: ${byStory.size}; chapter daily rows: ${byChapter.size}; timezone: ${timeZone}`);
  if (!apply) { console.log('Dry run only. Use --apply to SET canonical session-derived fields.'); return; }
  await prisma.$transaction(async (tx) => {
    for (const row of byStory.values()) {
      await tx.storyDailyStat.upsert({
        where: { storyId_date: { storyId: row.storyId, date: row.date } },
        create: { storyId: row.storyId, date: row.date, uniqueReaders: row.readers.size, readingStartCount: row.starts, completionCount: row.completions, readingSeconds: row.seconds },
        update: { uniqueReaders: row.readers.size, readingStartCount: row.starts, completionCount: row.completions, readingSeconds: row.seconds },
      });
    }
    for (const row of byChapter.values()) {
      await tx.chapterDailyStat.upsert({
        where: { chapterId_date: { chapterId: row.chapterId, date: row.date } },
        create: { chapterId: row.chapterId, date: row.date, uniqueReaders: row.readers.size, readingStartCount: row.starts, completionCount: row.completions, readingSeconds: row.seconds },
        update: { uniqueReaders: row.readers.size, readingStartCount: row.starts, completionCount: row.completions, readingSeconds: row.seconds },
      });
    }
  });
  console.log('Backfill applied. View metrics were not invented from ReadingSession data.');
}

main().finally(() => prisma.$disconnect());
