import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
} from '@angular/core';

import { Router } from '@angular/router';

import { AuthStore } from '../../../../../core/auth/auth.store';

import { ChangePasswordDialogComponent } from '../../components/change-password-dialog/change-password-dialog.component';
import { DeleteAccountDialogComponent } from '../../components/delete-account-dialog/delete-account-dialog.component';
import { SecurityScoreCardComponent } from '../../components/security-score-card/security-score-card.component';
import { SecuritySettingCardComponent } from '../../components/security-setting-card/security-setting-card.component';

import {
    ChangePasswordRequest,
    DeleteAccountRequest,
} from '../../data/account-security.models';

import { AccountSecurityStore } from '../../data/account-security.store';

@Component({
    selector:
        'app-account-security-page',
    standalone: true,
    imports: [
        SecuritySettingCardComponent,
        SecurityScoreCardComponent,
        ChangePasswordDialogComponent,
        DeleteAccountDialogComponent,
    ],
    templateUrl:
        './account-security-page.component.html',
    styleUrl:
        './account-security-page.component.scss',
    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class AccountSecurityPageComponent
    implements OnInit {
    private readonly router =
        inject(Router);

    private readonly auth =
        inject(AuthStore);

    protected readonly store =
        inject(AccountSecurityStore);

    protected readonly passwordDialogOpen =
        signal(false);

    protected readonly deleteDialogOpen =
        signal(false);

    ngOnInit(): void {
        this.store.load();
    }

    protected openPasswordDialog(): void {
        this.store.clearMessages();
        this.passwordDialogOpen.set(true);
    }

    protected changePassword(
        request: ChangePasswordRequest,
    ): void {
        this.store
            .changePassword(request)
            .subscribe({
                next: () => {
                    this.passwordDialogOpen.set(
                        false,
                    );
                },
            });
    }

    protected deleteAccount(
        request: DeleteAccountRequest,
    ): void {
        this.store
            .deleteAccount(request)
            .subscribe({
                next: () => {
                    this.deleteDialogOpen.set(
                        false,
                    );

                    this.auth.logout();

                    void this.router.navigateByUrl(
                        '/',
                    );
                },
            });
    }

    protected openMfa(): void {
        void this.router.navigateByUrl(
            '/tai-khoan/bao-mat/xac-thuc-2-lop',
        );
    }

    protected openRecoveryEmail(): void {
        void this.router.navigateByUrl(
            '/tai-khoan/bao-mat/email-khoi-phuc',
        );
    }

    protected openSecurityQuestions(): void {
        void this.router.navigateByUrl(
            '/tai-khoan/bao-mat/cau-hoi-bao-mat',
        );
    }

    protected openSessions(): void {
        void this.router.navigateByUrl(
            '/tai-khoan/thiet-bi',
        );
    }

    protected showSuggestions(): void {
        const score =
            this.store.securityScore();

        const firstIncomplete =
            score.items.find(
                (item) => !item.completed,
            );

        switch (firstIncomplete?.id) {
            case 'mfa':
                this.openMfa();
                break;

            case 'recovery-email':
                this.openRecoveryEmail();
                break;

            case 'security-questions':
                this.openSecurityQuestions();
                break;

            case 'trusted-device':
                this.openSessions();
                break;

            default:
                this.openPasswordDialog();
        }
    }
}