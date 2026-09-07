export interface WeeklyReadingDayStatsDto {
  readonly date: string;
  readonly readingMinutes: number;
  readonly chaptersCompleted: number;
  readonly active: boolean;
}

export interface WeeklyReadingStatsResultDto {
  readonly startDate: string;
  readonly endDate: string;
  readonly timeZone: string;
  readonly currentStreakDays: number;
  readonly longestStreakDays: number;
  readonly readingMinutes: number;
  readonly chaptersCompleted: number;
  readonly activeDays: number;
  readonly daily: readonly WeeklyReadingDayStatsDto[];
}
