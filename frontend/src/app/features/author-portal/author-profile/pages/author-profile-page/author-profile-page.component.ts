import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { provideAuthorProfile } from '../../data-access/author-profile.providers';
import { AuthorProfileStore } from '../../data-access/author-profile.store';

@Component({
  selector: 'app-author-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  providers: [...provideAuthorProfile(), AuthorProfileStore],
  templateUrl: './author-profile-page.component.html',
  styleUrl: './author-profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorProfilePageComponent {
  protected readonly store = inject(AuthorProfileStore);
  protected readonly form = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    bio: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
    website: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    facebook: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    instagram: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    x: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    youtube: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    tiktok: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  private populatedProfileId: string | null = null;

  constructor() {
    effect(() => {
      const profile = this.store.profile();
      if (!profile || (this.populatedProfileId === profile.id && this.form.dirty)) return;
      this.populatedProfileId = profile.id;
      this.form.reset({
        displayName: profile.displayName,
        bio: profile.bio ?? '',
        website: profile.socialLinks.website ?? '',
        facebook: profile.socialLinks.facebook ?? '',
        instagram: profile.socialLinks.instagram ?? '',
        x: profile.socialLinks.x ?? '',
        youtube: profile.socialLinks.youtube ?? '',
        tiktok: profile.socialLinks.tiktok ?? '',
      });
    });
    this.store.load();
  }

  protected save(): void {
    if (this.form.invalid || this.store.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.store.save(
      {
        displayName: value.displayName,
        bio: value.bio || null,
        socialLinks: {
          website: value.website || null,
          facebook: value.facebook || null,
          instagram: value.instagram || null,
          x: value.x || null,
          youtube: value.youtube || null,
          tiktok: value.tiktok || null,
        },
      },
      () => this.form.markAsPristine(),
    );
  }

  protected avatarSelected(event: Event): void {
    const file = selectedFile(event);
    if (file) this.store.uploadAvatar(file);
  }
  protected bannerSelected(event: Event): void {
    const file = selectedFile(event);
    if (file) this.store.uploadBanner(file);
  }
}

function selectedFile(event: Event): File | null {
  return (event.target as HTMLInputElement).files?.item(0) ?? null;
}
