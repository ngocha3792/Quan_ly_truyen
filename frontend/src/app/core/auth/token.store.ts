import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly accessTokenState = signal<string | null>(null);
  readonly accessToken = this.accessTokenState.asReadonly();
  readonly authenticated = computed(() => Boolean(this.accessTokenState()));

  set(token: string): void {
    this.accessTokenState.set(token);
  }

  clear(): void {
    this.accessTokenState.set(null);
  }
}
