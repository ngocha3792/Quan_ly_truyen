import { Injectable, signal } from '@angular/core';

import { AccountUiPreferences } from '../domain/account-profile.models';

const STORAGE_KEY = 'truyenhub.account.ui-preferences';

const DEFAULT_PREFERENCES: AccountUiPreferences = {
  newChapterNotifications: true,
  showRecentActivity: true,
  allowUpdateEmails: true,
};

@Injectable({
  providedIn: 'root',
})
export class AccountPreferencesStore {
  private readonly preferencesState = signal<AccountUiPreferences>(this.read());

  readonly preferences = this.preferencesState.asReadonly();

  update(changes: Partial<AccountUiPreferences>): void {
    const nextValue = {
      ...this.preferencesState(),
      ...changes,
    };

    this.preferencesState.set(nextValue);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
    }
  }

  reset(): void {
    this.preferencesState.set(DEFAULT_PREFERENCES);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  private read(): AccountUiPreferences {
    if (typeof window === 'undefined') {
      return DEFAULT_PREFERENCES;
    }

    const storedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return DEFAULT_PREFERENCES;
    }

    try {
      const parsed = JSON.parse(storedValue) as Partial<AccountUiPreferences>;

      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }
}
