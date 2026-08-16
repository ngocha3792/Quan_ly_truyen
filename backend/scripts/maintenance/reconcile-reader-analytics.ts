import 'dotenv/config';
import { Prisma } from '../../src/generated/prisma/client';
import { createScriptPrismaClient } from '../shared/prisma-client';

const prisma = createScriptPrismaClient();
const apply = process.argv.includes('--apply');
const timeZone = process.env.ANALYTICS_TIME_ZONE ?? 'Asia/Ho_Chi_Minh';
const storyFilter = option('--story-id');
const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const from = option('--from') ?? today;
const to = option('--to') ?? from;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function dates(fromKey: string, toKey: string): string[] {
  const result: string[] = [];
  const end = new Date(`${toKey}T00:00:00.000Z`);
  for (let day = new Date(`${fromKey}T00:00:00.000Z`); day <= end; day = new Date(day.getTime() + 86_400_000)) result.push(day.toISOString().slice(0, 10));
  return result;
}

async function main(): Promise<void> {
  let mismatches = 0;
  for (const dateKey of dates(from, to)) {
    const storyRows = await prisma.$queryRaw<Array<{ storyId: string; views: bigint; uniqueReaders: bigint; starts: bigint; completions: bigint; readingSeconds: bigint }>>(Prisma.sql`
      SELECT "story_id" AS "storyId",
        COUNT(*) FILTER (WHERE "type" = 'story_view')::bigint AS "views",
        COUNT(DISTINCT "viewer_key_hash") FILTER (WHERE "type" = 'story_view')::bigint AS "uniqueReaders",
        COUNT(*) FILTER (WHERE "type" = 'reading_started')::bigint AS "starts",
        COUNT(*) FILTER (WHERE "type" = 'reading_completed')::bigint AS "completions",
        COALESCE(SUM("active_seconds") FILTER (WHERE "type" = 'reading_progress'), 0)::bigint AS "readingSeconds"
      FROM "reader_analytics_events"
      WHERE "processed_at" IS NOT NULL
        AND ("occurred_at" AT TIME ZONE ${timeZone})::date = ${dateKey}::date
        ${storyFilter ? Prisma.sql`AND "story_id" = ${storyFilter}::uuid` : Prisma.empty}
      GROUP BY "story_id"
    `);
    const chapterRows = await prisma.$queryRaw<Array<{ chapterId: string; views: bigint; uniqueReaders: bigint; starts: bigint; completions: bigint; readingSeconds: bigint }>>(Prisma.sql`
      SELECT "chapter_id" AS "chapterId",
        COUNT(*) FILTER (WHERE "type" = 'chapter_view')::bigint AS "views",
        COUNT(DISTINCT "viewer_key_hash") FILTER (WHERE "type" = 'chapter_view')::bigint AS "uniqueReaders",
        COUNT(*) FILTER (WHERE "type" = 'reading_started')::bigint AS "starts",
        COUNT(*) FILTER (WHERE "type" = 'reading_completed')::bigint AS "completions",
        COALESCE(SUM("active_seconds") FILTER (WHERE "type" = 'reading_progress'), 0)::bigint AS "readingSeconds"
      FROM "reader_analytics_events"
      WHERE "processed_at" IS NOT NULL AND "chapter_id" IS NOT NULL
        AND ("occurred_at" AT TIME ZONE ${timeZone})::date = ${dateKey}::date
        ${storyFilter ? Prisma.sql`AND "story_id" = ${storyFilter}::uuid` : Prisma.empty}
      GROUP BY "chapter_id"
    `);
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    for (const row of storyRows) {
      const current = await prisma.storyDailyStat.findUnique({ where: { storyId_date: { storyId: row.storyId, date } } });
      const mismatch = !current || current.viewCount !== row.views || current.uniqueReaders !== Number(row.uniqueReaders) || current.readingStartCount !== Number(row.starts) || current.completionCount !== Number(row.completions) || current.readingSeconds !== row.readingSeconds;
      if (!mismatch) continue;
      mismatches += 1;
      console.log('[story]', dateKey, row.storyId, `views ${current?.viewCount ?? 'missing'} -> ${row.views}`, `unique ${current?.uniqueReaders ?? 'missing'} -> ${row.uniqueReaders}`);
      if (apply) await prisma.storyDailyStat.upsert({ where: { storyId_date: { storyId: row.storyId, date } }, create: { storyId: row.storyId, date, viewCount: row.views, uniqueReaders: Number(row.uniqueReaders), readingStartCount: Number(row.starts), completionCount: Number(row.completions), readingSeconds: row.readingSeconds }, update: { viewCount: row.views, uniqueReaders: Number(row.uniqueReaders), readingStartCount: Number(row.starts), completionCount: Number(row.completions), readingSeconds: row.readingSeconds } });
    }
    for (const row of chapterRows) {
      const current = await prisma.chapterDailyStat.findUnique({ where: { chapterId_date: { chapterId: row.chapterId, date } } });
      const mismatch = !current || current.viewCount !== row.views || current.uniqueReaders !== Number(row.uniqueReaders) || current.readingStartCount !== Number(row.starts) || current.completionCount !== Number(row.completions) || current.readingSeconds !== row.readingSeconds;
      if (!mismatch) continue;
      mismatches += 1;
      console.log('[chapter]', dateKey, row.chapterId, `views ${current?.viewCount ?? 'missing'} -> ${row.views}`, `unique ${current?.uniqueReaders ?? 'missing'} -> ${row.uniqueReaders}`);
      if (apply) await prisma.chapterDailyStat.upsert({ where: { chapterId_date: { chapterId: row.chapterId, date } }, create: { chapterId: row.chapterId, date, viewCount: row.views, uniqueReaders: Number(row.uniqueReaders), readingStartCount: Number(row.starts), completionCount: Number(row.completions), readingSeconds: row.readingSeconds }, update: { viewCount: row.views, uniqueReaders: Number(row.uniqueReaders), readingStartCount: Number(row.starts), completionCount: Number(row.completions), readingSeconds: row.readingSeconds } });
    }
  }
  console.log(`${apply ? 'Applied' : 'Dry run'}: ${mismatches} mismatch(es) in ${from}..${to}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
