import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';
export type AppLanguage = 'vi' | 'en';

const THEME_KEY = 'qlt-theme';
const LANGUAGE_KEY = 'qlt-language';

@Injectable({ providedIn: 'root' })
export class AppPreferencesService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  readonly theme = signal<AppTheme>(this.readTheme());
  readonly language = signal<AppLanguage>(this.readLanguage());
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    effect(() => {
      const theme = this.theme();
      this.document.documentElement.dataset['theme'] = theme;
      if (this.browser) this.persist(THEME_KEY, theme);
    });

    effect(() => {
      const language = this.language();
      this.document.documentElement.lang = language;
      this.document.documentElement.dataset['language'] = language;
      if (this.browser) this.persist(LANGUAGE_KEY, language);
    });
  }

  toggleTheme(): void {
    this.theme.update((value) => (value === 'dark' ? 'light' : 'dark'));
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
  }

  toggleLanguage(): void {
    this.language.update((value) => (value === 'vi' ? 'en' : 'vi'));
  }

  setLanguage(language: AppLanguage): void {
    this.language.set(language);
  }

  private readTheme(): AppTheme {
    if (!this.browser) return 'dark';
    const saved = this.readStorage(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  private readLanguage(): AppLanguage {
    if (!this.browser) return 'vi';
    const saved = this.readStorage(LANGUAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
    return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'vi';
  }

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private persist(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable in private browsing or embedded webviews.
    }
  }
}
