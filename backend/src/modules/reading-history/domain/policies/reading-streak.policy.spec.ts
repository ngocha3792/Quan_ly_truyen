import {
  buildWeeklyReadingStats,
  dateKeyInTimeZone,
} from './reading-streak.policy';

describe('reading streak policy', () => {
  it('builds a rolling seven-day summary and keeps a streak alive until today ends', () => {
    const result = buildWeeklyReadingStats(
      [
        activity('2026-08-29', 60, 1),
        activity('2026-08-30', 60, 1),
        activity('2026-08-31', 60, 1),
        activity('2026-09-01', 60, 1),
        activity('2026-09-04', 120, 1),
        activity('2026-09-05', 30, 0),
        activity('2026-09-06', 30, 1),
      ],
      '2026-09-07',
      'Asia/Ho_Chi_Minh',
    );

    expect(result).toMatchObject({
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      currentStreakDays: 3,
      longestStreakDays: 4,
      readingMinutes: 4,
      chaptersCompleted: 3,
      activeDays: 4,
    });
    expect(result.daily).toHaveLength(7);
    expect(result.daily[0]).toEqual({
      date: '2026-09-01',
      readingMinutes: 1,
      chaptersCompleted: 1,
      active: true,
    });
    expect(result.daily[6]?.active).toBe(false);
  });

  it('does not count opening a chapter without active reading or completion', () => {
    const result = buildWeeklyReadingStats(
      [activity('2026-09-07', 0, 0)],
      '2026-09-07',
      'Asia/Ho_Chi_Minh',
    );

    expect(result.currentStreakDays).toBe(0);
    expect(result.longestStreakDays).toBe(0);
    expect(result.activeDays).toBe(0);
  });

  it('uses the configured timezone for the current date key', () => {
    expect(
      dateKeyInTimeZone(
        new Date('2026-09-06T18:30:00.000Z'),
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe('2026-09-07');
  });
});

function activity(
  date: string,
  readingSeconds: number,
  chaptersCompleted: number,
) {
  return { date, readingSeconds, chaptersCompleted };
}
