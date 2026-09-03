import { Injectable } from '@nestjs/common';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ReadingGoalPersistencePort,
  ReadingGoalResultDto,
} from '../../application';

@Injectable()
export class PrismaReadingGoalPersistence implements ReadingGoalPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string): Promise<ReadingGoalResultDto> {
    try {
      const [goal, completedChapters] = await Promise.all([
        this.prisma.readingGoal.findUnique({ where: { userId } }),
        this.countCompletedThisWeek(userId),
      ]);

      return {
        targetChapters: goal?.targetChapters ?? 0,
        completedChapters,
        remainingDays: remainingDaysInCurrentWeek(),
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-goal-read-own',
        resource: 'Mục tiêu đọc',
      });
    }
  }

  async upsert(
    userId: string,
    targetChapters: number,
  ): Promise<ReadingGoalResultDto> {
    try {
      await this.prisma.readingGoal.upsert({
        where: { userId },
        create: { userId, targetChapters },
        update: { targetChapters },
      });

      return this.findMine(userId);
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-goal-upsert-own',
        resource: 'Mục tiêu đọc',
      });
    }
  }

  private async countCompletedThisWeek(userId: string): Promise<number> {
    const { periodStart, periodEnd } = currentWeekPeriod();
    return this.prisma.readingSession.count({
      where: {
        userId,
        completed: true,
        startedAt: { gte: periodStart, lt: periodEnd },
      },
    });
  }
}

function currentWeekPeriod(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Monday
  const periodStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - dayOfWeek,
    ),
  );
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);
  return { periodStart, periodEnd };
}

function remainingDaysInCurrentWeek(): number {
  const { periodEnd } = currentWeekPeriod();
  return Math.max(
    0,
    Math.ceil((periodEnd.getTime() - Date.now()) / 86_400_000),
  );
}
