import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import type { OfflineStorageScope } from '../offline/offline.models';
import { OfflineConnectivityService } from '../offline/offline-connectivity.service';
import { chunkManifestAssets, isAllowedManifestAssetUrl } from './service-worker-message.policy';

const PRIVATE_CACHE_PREFIX = 'truyenhub-offline-assets-';

type WorkerCommand =
  | { readonly type: 'SET_PRIVATE_SCOPE'; readonly scopeHash: string | null }
  | { readonly type: 'CLEAR_PRIVATE_CACHES' }
  | {
      readonly type: 'CACHE_MANIFEST_ASSETS';
      readonly scopeHash: string;
      readonly assets: string[];
    }
  | {
      readonly type: 'REMOVE_MANIFEST_ASSETS';
      readonly scopeHash: string;
      readonly assets: string[];
    }
  | { readonly type: 'SKIP_WAITING' };

@Injectable({ providedIn: 'root' })
export class ServiceWorkerRegistrationService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly connectivity = inject(OfflineConnectivityService);
  private readonly registrationState = signal<ServiceWorkerRegistration | null>(null);
  private readonly errorState = signal<string | null>(null);
  private registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
  private privateScopeHash: string | null = null;
  private privateScopeRevision = 0;
  private observingController = false;

  readonly registration = this.registrationState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly enabled = this.browser && this.config.production && 'serviceWorker' in navigator;

  register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.enabled) return Promise.resolve(null);
    this.registrationPromise ??= this.registerWorker();
    return this.registrationPromise;
  }

  async setPrivateScope(scope: OfflineStorageScope | null): Promise<void> {
    const revision = ++this.privateScopeRevision;
    const nextHash = scope ? await hashScope(scope) : null;
    if (revision !== this.privateScopeRevision) return;
    this.privateScopeHash = nextHash;
    await this.sendCommand({ type: 'SET_PRIVATE_SCOPE', scopeHash: nextHash });
  }

  async cacheManifestAssets(assets: readonly string[]): Promise<number> {
    const scopeHash = this.privateScopeHash;
    if (!scopeHash) return 0;
    const allowed = uniqueAllowedAssets(assets, window.location.origin, this.config.apiBaseUrl);
    if (allowed.length === 0) return 0;
    let cached = 0;
    for (const assetsChunk of chunkManifestAssets(allowed)) {
      if (this.privateScopeHash !== scopeHash) break;
      const result = await this.sendCommand({
        type: 'CACHE_MANIFEST_ASSETS',
        scopeHash,
        assets: [...assetsChunk],
      });
      cached += result?.cached ?? 0;
    }
    return cached;
  }

  async removeManifestAssets(assets: readonly string[]): Promise<number> {
    const scopeHash = this.privateScopeHash;
    if (!scopeHash) return 0;
    const allowed = uniqueAllowedAssets(assets, window.location.origin, this.config.apiBaseUrl);
    if (allowed.length === 0) return 0;
    let removed = 0;
    let failed = false;
    for (const assetsChunk of chunkManifestAssets(allowed)) {
      if (this.privateScopeHash !== scopeHash) break;
      const result = await this.sendCommand({
        type: 'REMOVE_MANIFEST_ASSETS',
        scopeHash,
        assets: [...assetsChunk],
      });
      if (!result) {
        failed = true;
        break;
      }
      removed += result?.removed ?? 0;
    }
    if (failed && this.privateScopeHash === scopeHash) {
      await this.purgePrivateCaches(scopeHash);
    }
    return removed;
  }

  async clearPrivateCaches(): Promise<void> {
    this.privateScopeRevision += 1;
    this.privateScopeHash = null;
    await this.purgePrivateCaches(null);
  }

  private async purgePrivateCaches(preserveScopeHash: string | null): Promise<void> {
    const workerResult = await this.sendCommand({ type: 'CLEAR_PRIVATE_CACHES' });
    let localVerified = false;
    if (this.browser && typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(PRIVATE_CACHE_PREFIX))
          .map((name) => caches.delete(name)),
      );
      localVerified = !(await caches.keys()).some((name) => name.startsWith(PRIVATE_CACHE_PREFIX));
    }
    if (!workerResult && !localVerified && this.enabled) {
      throw new Error('Không thể xác nhận đã xóa private offline cache.');
    }
    if (preserveScopeHash && this.privateScopeHash === preserveScopeHash) {
      await this.sendCommand({ type: 'SET_PRIVATE_SCOPE', scopeHash: preserveScopeHash });
    }
  }

  async activateUpdate(): Promise<boolean> {
    const registration = await this.register();
    const waiting = registration?.waiting;
    if (!waiting) return false;
    waiting.postMessage({ type: 'SKIP_WAITING' } satisfies WorkerCommand);
    this.connectivity.markUpdateApplied();
    return true;
  }

  private async registerWorker(): Promise<ServiceWorkerRegistration | null> {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.registrationState.set(registration);
      this.observeRegistration(registration);
      await navigator.serviceWorker.ready;
      if (this.privateScopeHash) {
        await this.sendCommand({
          type: 'SET_PRIVATE_SCOPE',
          scopeHash: this.privateScopeHash,
        });
      }
      return registration;
    } catch (error) {
      this.registrationPromise = null;
      this.errorState.set(
        error instanceof Error ? error.message : 'Không thể đăng ký Service Worker.',
      );
      return null;
    }
  }

  private observeRegistration(registration: ServiceWorkerRegistration): void {
    if (registration.waiting && navigator.serviceWorker.controller) {
      this.connectivity.markUpdateAvailable();
    }
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          this.connectivity.markUpdateAvailable();
        }
      });
    });
    if (!this.observingController) {
      this.observingController = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.connectivity.markUpdateApplied();
        if (this.privateScopeHash) {
          void this.sendCommand({
            type: 'SET_PRIVATE_SCOPE',
            scopeHash: this.privateScopeHash,
          });
        }
      });
    }
  }

  private async sendCommand(
    command: WorkerCommand,
  ): Promise<{ readonly cached?: number; readonly removed?: number } | null> {
    if (!this.enabled) return null;
    const registration = this.registrationState() ?? (await this.register());
    const worker = navigator.serviceWorker.controller ?? registration?.active;
    if (!worker) return null;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        resolve(null);
      }, 5000);
      channel.port1.addEventListener(
        'message',
        (
          event: MessageEvent<{
            readonly success?: boolean;
            readonly cached?: number;
            readonly removed?: number;
          }>,
        ) => {
          window.clearTimeout(timeout);
          channel.port1.close();
          resolve(event.data?.success ? event.data : null);
        },
        { once: true },
      );
      channel.port1.start();
      worker.postMessage(command, [channel.port2]);
    });
  }
}

function uniqueAllowedAssets(
  assets: readonly string[],
  appOrigin: string,
  apiBaseUrl: string,
): string[] {
  return [...new Set(assets)].filter((asset) =>
    isAllowedManifestAssetUrl(asset, appOrigin, apiBaseUrl),
  );
}

async function hashScope(scope: OfflineStorageScope): Promise<string> {
  const input = new TextEncoder().encode(`${scope.userId}:${scope.sessionId}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
