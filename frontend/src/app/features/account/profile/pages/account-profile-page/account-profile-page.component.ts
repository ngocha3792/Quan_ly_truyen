import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
} from '@angular/core';

import { Router } from '@angular/router';

import { AccountProfileFormComponent } from '../../components/account-profile-form/account-profile-form.component';
import { ProfileCompletionCardComponent } from '../../components/profile-completion-card/profile-completion-card.component';

import { AccountProfileFormValue } from '../../data/account-profile.models';
import { AccountPreferencesStore } from '../../data/account-preferences.store';
import { AccountProfileStore } from '../../data/account-profile.store';

@Component({
    selector:
        'app-account-profile-page',
    standalone: true,
    imports: [
        AccountProfileFormComponent,
        ProfileCompletionCardComponent,
    ],
    templateUrl:
        './account-profile-page.component.html',
    styleUrl:
        './account-profile-page.component.scss',
    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class AccountProfilePageComponent {
    private readonly router =
        inject(Router);

    protected readonly store =
        inject(AccountProfileStore);

    protected readonly preferencesStore =
        inject(AccountPreferencesStore);

    private readonly avatarFileState =
        signal<File | null>(null);

    protected save(
        formValue: AccountProfileFormValue,
    ): void {
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

    protected setAvatar(
        file: File | null,
    ): void {
        this.avatarFileState.set(file);
        this.store.clearMessages();
    }

    protected cancel(): void {
        void this.router.navigateByUrl(
            '/tai-khoan',
        );
    }
}