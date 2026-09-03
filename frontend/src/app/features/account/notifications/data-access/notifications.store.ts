import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

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

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingNotificationIds = signal<readonly string[]>([]);
  readonly pendingSettingKeys = signal<readonly NotificationSettingKey[]>([]);
  readonly markAllPending = signal(false);

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
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.repository
      .getNotifications()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (view) => {
          this.viewState.set(view);
          this.settings.set(view.settings);
        },
        error: () => this.error.set('Không thể tải thông báo. Vui lòng thử lại.'),
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

    if (!notification || this.pendingNotificationIds().includes(notificationId)) {
      return;
    }

    const isRead = !notification.isRead;
    const snapshot = this.viewState();

    this.error.set(null);
    this.addPendingNotification(notificationId);
    this.updateNotification(notificationId, (current) => ({ ...current, isRead }));

    this.repository
      .setRead(notificationId, isRead)
      .pipe(
        finalize(() => this.removePendingNotification(notificationId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => {
          this.viewState.set(snapshot);
          this.error.set('Không thể cập nhật trạng thái thông báo. Thay đổi đã được hoàn tác.');
        },
      });
  }

  toggleSaved(notificationId: string): void {
    const notification = this.findNotification(notificationId);

    if (!notification || this.pendingNotificationIds().includes(notificationId)) {
      return;
    }

    const isSaved = !notification.isSaved;
    const snapshot = this.viewState();

    this.error.set(null);
    this.addPendingNotification(notificationId);
    this.updateNotification(notificationId, (current) => ({ ...current, isSaved }));

    this.repository
      .setSaved(notificationId, isSaved)
      .pipe(
        finalize(() => this.removePendingNotification(notificationId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => {
          this.viewState.set(snapshot);
          this.error.set('Không thể lưu thông báo. Thay đổi đã được hoàn tác.');
        },
      });
  }

  markAllAsRead(): void {
    const view = this.viewState();

    if (!view || this.unreadCount() === 0 || this.markAllPending()) {
      return;
    }

    const snapshot = view;
    this.error.set(null);
    this.markAllPending.set(true);
    this.viewState.set({
      ...view,
      notifications: view.notifications.map((notification) => ({
        ...notification,
        isRead: true,
      })),
      statistics: { ...view.statistics, unread: 0 },
    });

    this.repository
      .markAllAsRead()
      .pipe(
        finalize(() => this.markAllPending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => {
          this.viewState.set(snapshot);
          this.error.set('Không thể đánh dấu tất cả là đã đọc. Thay đổi đã được hoàn tác.');
        },
      });
  }

  toggleSetting(settingKey: NotificationSettingKey): void {
    if (this.pendingSettingKeys().includes(settingKey)) {
      return;
    }

    const previous = this.settings();
    const value = !this.settings()[settingKey];

    this.error.set(null);
    this.pendingSettingKeys.update((keys) => [...keys, settingKey]);
    this.settings.set({ ...previous, [settingKey]: value });

    this.repository
      .updateSettings({ [settingKey]: value })
      .pipe(
        finalize(() =>
          this.pendingSettingKeys.update((keys) => keys.filter((key) => key !== settingKey)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (settings) => this.settings.set(settings),
        error: () => {
          this.settings.set(previous);
          this.error.set('Không thể cập nhật tùy chọn thông báo. Thay đổi đã được hoàn tác.');
        },
      });
  }

  clearError(): void {
    this.error.set(null);
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

  private addPendingNotification(notificationId: string): void {
    this.pendingNotificationIds.update((ids) => [...ids, notificationId]);
  }

  private removePendingNotification(notificationId: string): void {
    this.pendingNotificationIds.update((ids) => ids.filter((id) => id !== notificationId));
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
