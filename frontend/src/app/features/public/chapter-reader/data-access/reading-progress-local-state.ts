import { inject, Injectable } from '@angular/core';

import { AuthStore } from '../../../../core/auth/auth.store';
import type { ProgressUpdateEvent } from './reading-progress-sync.events';

const DEVICE_ID_KEY = 'qlt:reading-progress:device-id';

export function readingProgressDeviceId(): string {
  const current = localStorage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function persistPendingProgress(userId: string, event: ProgressUpdateEvent): void {
  localStorage.setItem(pendingKey(userId, event.storyId), JSON.stringify(event));
}

export function readPendingProgress(userId: string, storyId: string): ProgressUpdateEvent | null {
  const key = pendingKey(userId, storyId);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProgressUpdateEvent;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function clearPendingProgress(userId: string, storyId: string): void {
  localStorage.removeItem(pendingKey(userId, storyId));
}

@Injectable()
export class ReadingProgressLocalState {
  private readonly auth = inject(AuthStore);

  persist(event: ProgressUpdateEvent): void {
    const userId = this.auth.user()?.id;
    if (userId) persistPendingProgress(userId, event);
  }

  read(storyId: string | undefined): ProgressUpdateEvent | null {
    const userId = this.auth.user()?.id;
    return userId && storyId ? readPendingProgress(userId, storyId) : null;
  }

  clear(storyId: string | undefined): void {
    const userId = this.auth.user()?.id;
    if (userId && storyId) clearPendingProgress(userId, storyId);
  }
}

function pendingKey(userId: string, storyId: string): string {
  return `qlt:reading-progress:pending:${userId}:${storyId}`;
}
