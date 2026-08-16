import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { EditableAuthorProfile, UpdateEditableAuthorProfile } from '../domain/author-profile.models';
import { AuthorProfileRepository } from '../domain/author-profile.repository';
import { AuthorProfileUploadService } from './author-profile-upload.service';

@Injectable()
export class AuthorProfileStore {
  private readonly repository = inject(AuthorProfileRepository);
  private readonly uploads = inject(AuthorProfileUploadService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<EditableAuthorProfile | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal<'avatar' | 'banner' | null>(null);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.repository.get().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (profile) => this.profile.set(profile),
      error: () => { this.error.set('Không thể tải hồ sơ tác giả.'); this.loading.set(false); },
      complete: () => this.loading.set(false),
    });
  }

  save(
    input: UpdateEditableAuthorProfile,
    onSuccess?: (profile: EditableAuthorProfile) => void,
  ): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.repository.update(input).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        onSuccess?.(profile);
      },
      error: (error: unknown) => { this.error.set(readApiMessage(error, 'Không thể lưu hồ sơ tác giả.')); this.saving.set(false); },
      complete: () => this.saving.set(false),
    });
  }

  uploadAvatar(file: File): void { this.uploadAndAttach(file, 'avatar'); }
  uploadBanner(file: File): void { this.uploadAndAttach(file, 'banner'); }
  clearAvatar(): void { this.save({ avatarMediaId: null }); }
  clearBanner(): void { this.save({ bannerMediaId: null }); }

  private uploadAndAttach(file: File, kind: 'avatar' | 'banner'): void {
    const profile = this.profile();
    if (!profile || this.uploading()) return;
    this.uploading.set(kind);
    this.error.set(null);
    const purpose = kind === 'avatar' ? 'AVATAR' as const : 'AUTHOR_BANNER' as const;
    this.uploads
      .upload(profile.id, file, purpose)
      .pipe(
        switchMap((media) =>
          this.repository.update(kind === 'avatar' ? { avatarMediaId: media.id } : { bannerMediaId: media.id }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (canonical) => this.profile.set(canonical),
        error: (error: unknown) => { this.error.set(readApiMessage(error, 'Không thể tải ảnh lên.')); this.uploading.set(null); },
        complete: () => this.uploading.set(null),
      });
  }
}

function readApiMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const payload = error as { error?: { error?: { message?: unknown }; message?: unknown } };
  const value = payload.error?.error?.message ?? payload.error?.message;
  return typeof value === 'string' && value.trim() ? value : fallback;
}
