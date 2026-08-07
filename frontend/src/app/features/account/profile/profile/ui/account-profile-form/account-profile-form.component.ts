import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { CurrentUser } from '../../../../../../core/auth/auth.models';
import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { AccountProfileFormValue, AccountUiPreferences } from '../../domain/account-profile.models';

import { ProfileAvatarEditorComponent } from '../profile-avatar-editor/profile-avatar-editor.component';
import { ProfileSwitchComponent } from '../profile-switch/profile-switch.component';

interface ProfileForm {
  displayName: FormControl<string>;
  username: FormControl<string>;
  email: FormControl<string>;
  bio: FormControl<string>;
}

@Component({
  selector: 'app-account-profile-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IconComponent,
    ProfileAvatarEditorComponent,
    ProfileSwitchComponent,
  ],
  templateUrl: './account-profile-form.component.html',
  styleUrl: './account-profile-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountProfileFormComponent {
  readonly user = input.required<CurrentUser>();

  readonly membershipLabel = input('Thành viên');

  readonly saving = input(false);
  readonly avatarChanged =
    input(false);

  readonly preferences = input.required<AccountUiPreferences>();

  readonly saveRequested = output<AccountProfileFormValue>();

  readonly avatarSelected = output<File | null>();

  readonly preferencesChanged = output<Partial<AccountUiPreferences>>();

  readonly cancelRequested = output<void>();

  private readonly initialSnapshot = injectInitialSnapshot();

  protected readonly form = new FormGroup<ProfileForm>({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(120)],
    }),

    username: new FormControl(
      {
        value: '',
        disabled: true,
      },
      {
        nonNullable: true,
      },
    ),

    email: new FormControl(
      {
        value: '',
        disabled: true,
      },
      {
        nonNullable: true,
      },
    ),

    bio: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });

  constructor() {
    effect(() => {
      const user = this.user();

      const value = {
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        bio: user.bio ?? '',
      };

      this.form.reset(value, {
        emitEvent: false,
      });

      this.initialSnapshot.value = value;
    });
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) {
      return;
    }

    this.saveRequested.emit({
      displayName: this.form.controls.displayName.value,

      bio: this.form.controls.bio.value,
    });
  }

  protected resetForm(): void {
    const snapshot = this.initialSnapshot.value;

    if (!snapshot) {
      return;
    }

    this.form.reset(snapshot);
  }

  protected get bioLength(): number {
    return this.form.controls.bio.value.length;
  }
}

function injectInitialSnapshot(): {
  value: {
    displayName: string;
    username: string;
    email: string;
    bio: string;
  } | null;
} {
  return {
    value: null,
  };
}
