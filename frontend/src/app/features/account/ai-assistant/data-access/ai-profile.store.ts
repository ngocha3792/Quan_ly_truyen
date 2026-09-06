import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AiFallbackPolicy,
  AiPolicy,
  AiProfile,
  UpdateAiProfilePayload,
} from '../domain/ai-assistant.models';
import { AiAssistantRepository } from '../domain/ai-assistant.repository';

@Injectable()
export class AiProfileStore {
  private readonly repository = inject(AiAssistantRepository);
  private readonly destroyRef = inject(DestroyRef);

  readonly policy = signal<AiPolicy | null>(null);
  readonly policyLoading = signal(false);
  readonly profile = signal<AiProfile | null>(null);
  readonly profileLoading = signal(false);
  readonly error = signal<string | null>(null);

  loadPolicy(): void {
    this.policyLoading.set(true);
    this.error.set(null);
    this.repository
      .getPolicy()
      .pipe(
        finalize(() => this.policyLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (policy) => this.policy.set(policy),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  updateFallbackPolicy(fallbackPolicy: AiFallbackPolicy): void {
    if (this.policyLoading()) return;
    this.policyLoading.set(true);
    this.error.set(null);
    this.repository
      .updateFallbackPolicy(fallbackPolicy)
      .pipe(
        finalize(() => this.policyLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (policy) => this.policy.set(policy),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  loadProfile(): void {
    this.profileLoading.set(true);
    this.error.set(null);
    this.repository
      .getProfile()
      .pipe(
        finalize(() => this.profileLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  updateProfile(payload: UpdateAiProfilePayload): void {
    if (this.profileLoading()) return;
    this.profileLoading.set(true);
    this.error.set(null);
    this.repository
      .updateProfile(payload)
      .pipe(
        finalize(() => this.profileLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }
}
