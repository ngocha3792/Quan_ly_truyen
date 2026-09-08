import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { Subject } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class OfflineConnectivityService implements OnDestroy {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly onlineState = signal(this.browser ? navigator.onLine : true);
  private readonly installableState = signal(false);
  private readonly updateAvailableState = signal(false);
  private readonly onlineSubject = new Subject<boolean>();
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private initialized = false;

  readonly online = this.onlineState.asReadonly();
  readonly installable = this.installableState.asReadonly();
  readonly updateAvailable = this.updateAvailableState.asReadonly();
  readonly onlineChanges$ = this.onlineSubject.asObservable();

  initialize(): void {
    if (!this.browser || this.initialized) return;
    this.initialized = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('beforeinstallprompt', this.handleInstallPrompt);
    window.addEventListener('appinstalled', this.handleInstalled);
  }

  async promptInstall(): Promise<PwaInstallOutcome> {
    const prompt = this.installPrompt;
    if (!prompt) return 'unavailable';
    await prompt.prompt();
    const choice = await prompt.userChoice;
    this.installPrompt = null;
    this.installableState.set(false);
    return choice.outcome;
  }

  markUpdateAvailable(): void {
    this.updateAvailableState.set(true);
  }

  markUpdateApplied(): void {
    this.updateAvailableState.set(false);
  }

  ngOnDestroy(): void {
    if (!this.browser || !this.initialized) return;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('beforeinstallprompt', this.handleInstallPrompt);
    window.removeEventListener('appinstalled', this.handleInstalled);
    this.onlineSubject.complete();
  }

  private readonly handleOnline = (): void => {
    this.onlineState.set(true);
    this.onlineSubject.next(true);
  };

  private readonly handleOffline = (): void => {
    this.onlineState.set(false);
    this.onlineSubject.next(false);
  };

  private readonly handleInstallPrompt = (event: Event): void => {
    event.preventDefault();
    this.installPrompt = event as BeforeInstallPromptEvent;
    this.installableState.set(true);
  };

  private readonly handleInstalled = (): void => {
    this.installPrompt = null;
    this.installableState.set(false);
  };
}
