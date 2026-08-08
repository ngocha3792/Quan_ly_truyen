import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { Router } from '@angular/router';

import { AccountProfileFormComponent } from '../../ui/account-profile-form/account-profile-form.component';

import { ProfileCompletionCardComponent } from '../../ui/profile-completion-card/profile-completion-card.component';

import { AccountProfileFormValue } from '../../domain/account-profile.models';

import { AccountPreferencesStore } from '../../data-access/account-preferences.store';

import { AccountProfileStore } from '../../data-access/account-profile.store';

@Component({
  selector: 'app-account-profile-page',

  standalone: true,

  imports: [AccountProfileFormComponent, ProfileCompletionCardComponent],

  templateUrl: './account-profile-page.component.html',

  styleUrl: './account-profile-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountProfilePageComponent implements OnInit {
  private readonly router = inject(Router);

  protected readonly store = inject(AccountProfileStore);

  protected readonly preferencesStore = inject(AccountPreferencesStore);

  protected readonly avatarFileState = signal<File | null>(null);

  ngOnInit(): void {
    this.store.load();

    this.preferencesStore.load();
  }

  protected save(formValue: AccountProfileFormValue): void {
    this.store
      .save(
        formValue,

        this.avatarFileState(),
      )
      .subscribe({
        next: () => {
          this.avatarFileState.set(null);
        },
      });
  }

  protected setAvatar(file: File | null): void {
    this.avatarFileState.set(file);

    this.store.clearMessages();
  }

  protected cancel(): void {
    void this.router.navigateByUrl('/tai-khoan');
  }
}
