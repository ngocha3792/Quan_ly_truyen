import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { NotificationSettings, NotificationsView } from '../domain/notifications.models';
import { NotificationsRepository } from '../domain/notifications.repository';

@Injectable()
export class NotificationsHttpRepository implements NotificationsRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/notifications`;

  getNotifications(): Observable<NotificationsView> {
    return this.http
      .get<ApiSuccessEnvelope<NotificationsView>>(this.baseUrl)
      .pipe(map((response) => response.data));
  }

  setRead(notificationId: string, isRead: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${notificationId}/read`, {
      value: isRead,
    });
  }

  setSaved(notificationId: string, isSaved: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${notificationId}/saved`, {
      value: isSaved,
    });
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/read-all`, {});
  }

  updateSettings(
    settings: Partial<NotificationSettings>,
  ): Observable<NotificationSettings> {
    return this.http
      .patch<ApiSuccessEnvelope<NotificationSettings>>(`${this.baseUrl}/settings`, settings)
      .pipe(map((response) => response.data));
  }
}
