import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  NotificationCategory,
  NotificationSettingKey,
  NotificationSettings,
  NotificationsView,
  UserNotification,
} from '../domain/notifications.models';
import { NotificationsRepository } from '../domain/notifications.repository';

@Injectable()
export class NotificationsStore {
  private readonly repository = inject(NotificationsRepository);
  private readonly destroyRef = inject(DestroyRef);

  private readonly viewState = signal<NotificationsView | null>(null);

  readonly view = this.viewState.asReadonly();

  readonly query = signal('');
  readonly category = signal<NotificationCategory>('all');

  readonly page = signal(1);
  readonly pageSize = 8;

  readonly settings = signal<NotificationSettings>({
    newChapters: true,
    comments: true,
    system: true,
    promotions: true,
  });

  readonly filteredNotifications = computed(() => {
    const view = this.viewState();

    if (!view) {
      return [];
    }

    const normalizedQuery = this.query().trim().toLocaleLowerCase('vi');

    return view.notifications.filter((notification) => {
      const matchesSearch =
        !normalizedQuery ||
        [notification.title, notification.message, notification.tag]
          .join(' ')
          .toLocaleLowerCase('vi')
          .includes(normalizedQuery);

      const matchesCategory = this.matchesCategory(notification);

      return matchesSearch && matchesCategory;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredNotifications().length / this.pageSize)),
  );

  readonly visiblePages = computed(() =>
    Array.from(
      {
        length: this.totalPages(),
      },
      (_, index) => index + 1,
    ),
  );

  readonly notifications = computed(() => {
    const start = (this.page() - 1) * this.pageSize;

    return this.filteredNotifications().slice(start, start + this.pageSize);
  });

  readonly unreadCount = computed(() => {
    const view = this.viewState();

    if (!view) {
      return 0;
    }

    return view.notifications.filter((item) => !item.isRead).length;
  });

  readonly savedCount = computed(() => {
    const view = this.viewState();

    if (!view) {
      return 0;
    }

    return view.notifications.filter((item) => item.isSaved).length;
  });

  load(): void {
    this.repository
      .getNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((view) => {
        this.viewState.set(view);
        this.settings.set(view.settings);
      });
  }

  setQuery(query: string): void {
    this.query.set(query);
    this.page.set(1);
  }

  setCategory(category: NotificationCategory): void {
    this.category.set(category);
    this.page.set(1);
  }

  setPage(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  previousPage(): void {
    this.setPage(this.page() - 1);
  }

  nextPage(): void {
    this.setPage(this.page() + 1);
  }

  toggleRead(notificationId: string): void {
    const notification = this.findNotification(notificationId);

    if (!notification) {
      return;
    }

    const isRead = !notification.isRead;

    this.repository
      .setRead(notificationId, isRead)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateNotification(notificationId, (current) => ({
          ...current,
          isRead,
        }));
      });
  }

  toggleSaved(notificationId: string): void {
    const notification = this.findNotification(notificationId);

    if (!notification) {
      return;
    }

    const isSaved = !notification.isSaved;

    this.repository
      .setSaved(notificationId, isSaved)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateNotification(notificationId, (current) => ({
          ...current,
          isSaved,
        }));
      });
  }

  markAllAsRead(): void {
    const view = this.viewState();

    if (!view || this.unreadCount() === 0) {
      return;
    }

    this.repository
      .markAllAsRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.viewState.update((current) =>
          current
            ? {
                ...current,
                notifications: current.notifications.map((notification) => ({
                  ...notification,
                  isRead: true,
                })),
                statistics: {
                  ...current.statistics,
                  unread: 0,
                },
              }
            : current,
        );
      });
  }

  toggleSetting(settingKey: NotificationSettingKey): void {
    const value = !this.settings()[settingKey];

    this.repository
      .updateSettings({ [settingKey]: value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => this.settings.set(settings));
  }

  private findNotification(notificationId: string): UserNotification | undefined {
    return this.viewState()?.notifications.find(
      (notification) => notification.id === notificationId,
    );
  }

  private updateNotification(
    notificationId: string,
    updater: (notification: UserNotification) => UserNotification,
  ): void {
    const view = this.viewState();

    if (!view) {
      return;
    }

    const notifications = view.notifications.map((notification) =>
      notification.id === notificationId ? updater(notification) : notification,
    );

    this.viewState.set({
      ...view,
      notifications,
      statistics: {
        ...view.statistics,
        unread: notifications.filter((notification) => !notification.isRead).length,
        saved: notifications.filter((notification) => notification.isSaved).length,
      },
    });
  }

  private matchesCategory(notification: UserNotification): boolean {
    switch (this.category()) {
      case 'unread':
        return !notification.isRead;

      case 'story':
      case 'account':
      case 'system':
      case 'promotion':
        return notification.category === this.category();

      case 'all':
      default:
        return true;
    }
  }
}
