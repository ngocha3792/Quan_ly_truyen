import type { WeeklyReadingStatsResultDto } from '../../application/dto';

export interface ReadingActivityDay {
  readonly date: string;
  readonly readingSeconds: number;
  readonly chaptersCompleted: number;
}

export function buildWeeklyReadingStats(
  rows: readonly ReadingActivityDay[],
  today: string,
  timeZone: string,
): WeeklyReadingStatsResultDto {
  const activity = new Map(rows.map((row) => [row.date, row]));
  const end = parseDateKey(today);
  const start = addDays(end, -6);
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = dateKey(addDays(start, index));
    const row = activity.get(date);
    const readingSeconds = Math.max(0, row?.readingSeconds ?? 0);
    const chaptersCompleted = Math.max(0, row?.chaptersCompleted ?? 0);
    return {
      date,
      readingMinutes: minutes(readingSeconds),
      chaptersCompleted,
      active: readingSeconds > 0 || chaptersCompleted > 0,
    };
  });
  const activeDates = [...activity.values()]
    .filter((row) => row.readingSeconds > 0 || row.chaptersCompleted > 0)
    .map((row) => row.date)
    .sort();
  const weeklyRows = rows.filter(
    (row) => row.date >= dateKey(start) && row.date <= today,
  );

  return {
    startDate: dateKey(start),
    endDate: today,
    timeZone,
    currentStreakDays: currentStreak(activeDates, today),
    longestStreakDays: longestStreak(activeDates),
    readingMinutes: minutes(
      weeklyRows.reduce((total, row) => total + row.readingSeconds, 0),
    ),
    chaptersCompleted: weeklyRows.reduce(
      (total, row) => total + row.chaptersCompleted,
      0,
    ),
    activeDays: daily.filter((day) => day.active).length,
    daily,
  };
}

export function dateKeyInTimeZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function currentStreak(activeDates: readonly string[], today: string): number {
  const active = new Set(activeDates);
  let cursor = parseDateKey(today);
  if (!active.has(today)) cursor = addDays(cursor, -1);

  let streak = 0;
  while (active.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function longestStreak(activeDates: readonly string[]): number {
  let longest = 0;
  let current = 0;
  let previous: Date | undefined;

  for (const key of [...new Set(activeDates)].sort()) {
    const date = parseDateKey(key);
    current =
      previous && dateKey(addDays(previous, 1)) === key ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

function minutes(seconds: number): number {
  return Math.round(Math.max(0, seconds) / 60);
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
