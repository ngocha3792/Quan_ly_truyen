import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthorDashboardDto } from '../../dto';
import { AuthorDashboardMapper } from '../../mappers';
import {
  AUTHOR_PERSISTENCE_PORT,
  type AuthorPersistencePort,
} from '../../ports';

import { GetAuthorDashboardQuery } from './get-author-dashboard.query';

@Injectable()
export class GetAuthorDashboardQueryHandler {
  constructor(
    @Inject(AUTHOR_PERSISTENCE_PORT)
    private readonly persistence: AuthorPersistencePort,
  ) {}

  async execute(query: GetAuthorDashboardQuery): Promise<AuthorDashboardDto> {
    const { userId } = query;
    const now = new Date();
    const start90Days = this.startOfDay(this.addDays(now, -89));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      profile,
      stories,
      draftChapters,
      scheduledChapters,
      comments,
      dailyStats,
      unreadNotifications,
      publishedThisMonth,
    ] = await Promise.all([
      this.persistence.findDashboardProfile(userId),
      this.persistence.findDashboardStories(userId),
      this.persistence.findDraftChapters(userId, 4),
      this.persistence.findScheduledChapters(userId, 4),
      this.persistence.findRecentComments(userId, 3),
      this.persistence.findDailyStats(userId, start90Days),
      this.persistence.countUnreadNotifications(userId, now),
      this.persistence.countPublishedChaptersThisMonth(userId, monthStart),
    ]);

    if (!profile) {
      throw new NotFoundException('Author profile not found');
    }

    return AuthorDashboardMapper.toDto(
      {
        profile,
        stories,
        draftChapters,
        scheduledChapters,
        comments,
        dailyStats,
        unreadNotifications,
        publishedThisMonth,
      },
      now,
    );
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
