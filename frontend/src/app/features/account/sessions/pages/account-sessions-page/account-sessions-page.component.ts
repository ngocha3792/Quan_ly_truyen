import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
} from '@angular/core';

import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import {
    AccountSessionViewModel,
    SessionFilter,
} from '../../domain/account-session.models';

import { AccountSessionsStore } from '../../data-access/account-sessions.store';

import { ConfirmSessionDialogComponent } from '../../ui/confirm-session-dialog/confirm-session-dialog.component';
import { CurrentSessionCardComponent } from '../../ui/current-session-card/current-session-card.component';
import { RecentLoginCardComponent } from '../../ui/recent-login-card/recent-login-card.component';
import { SecurityTipsCardComponent } from '../../ui/security-tips-card/security-tips-card.component';
import { SessionListComponent } from '../../ui/session-list/session-list.component';
import { SessionListToolbarComponent } from '../../ui/session-list-toolbar/session-list-toolbar.component';
import { SessionStatCardComponent } from '../../ui/session-stat-card/session-stat-card.component';

type ConfirmationMode =
    | {
        readonly type: 'single';
        readonly session:
        AccountSessionViewModel;
    }
    | {
        readonly type: 'all';
        readonly count: number;
    };

@Component({
    selector:
        'app-account-sessions-page',

    standalone: true,

    imports: [
        RelativeTimePipe,

        SessionStatCardComponent,
        CurrentSessionCardComponent,
        SessionListToolbarComponent,
        SessionListComponent,
        SecurityTipsCardComponent,
        RecentLoginCardComponent,
        ConfirmSessionDialogComponent,
    ],

    templateUrl:
        './account-sessions-page.component.html',

    styleUrl:
        './account-sessions-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class AccountSessionsPageComponent
    implements OnInit {
    protected readonly store =
        inject(AccountSessionsStore);

    protected readonly confirmation =
        signal<ConfirmationMode | null>(
            null,
        );

    ngOnInit(): void {
        this.store.load();
    }

    protected requestSingleRevoke(
        session: AccountSessionViewModel,
    ): void {
        this.store.clearMessages();

        this.confirmation.set({
            type: 'single',
            session,
        });
    }

    protected requestAllRevoke(): void {
        const count =
            this.store.revocableSessionCount();

        if (count === 0) {
            return;
        }

        this.store.clearMessages();

        this.confirmation.set({
            type: 'all',
            count,
        });
    }

    protected confirmRevoke(): void {
        const confirmation =
            this.confirmation();

        if (!confirmation) {
            return;
        }

        if (
            confirmation.type === 'single'
        ) {
            this.store
                .revokeSession(
                    confirmation.session.id,
                )
                .subscribe({
                    next: () => {
                        this.confirmation.set(
                            null,
                        );
                    },
                });

            return;
        }

        this.store
            .revokeAllOtherSessions()
            .subscribe({
                next: () => {
                    this.confirmation.set(null);
                },
            });
    }

    protected setFilter(
        filter: SessionFilter,
    ): void {
        this.store.setFilter(filter);
    }

    protected confirmationTitle():
        string {
        const confirmation =
            this.confirmation();

        if (
            confirmation?.type === 'all'
        ) {
            return 'Thu hồi tất cả phiên khác?';
        }

        return 'Thu hồi phiên đăng nhập?';
    }

    protected confirmationMessage():
        string {
        const confirmation =
            this.confirmation();

        if (!confirmation) {
            return '';
        }

        if (
            confirmation.type === 'all'
        ) {
            return [
                `Có ${confirmation.count} phiên đăng nhập sẽ bị thu hồi.`,
                'Các thiết bị đó phải đăng nhập lại để tiếp tục sử dụng TruyenHub.',
            ].join(' ');
        }

        return [
            `Phiên “${confirmation.session.title}” sẽ bị đăng xuất ngay lập tức.`,
            'Hãy tiếp tục nếu bạn không nhận ra thiết bị này.',
        ].join(' ');
    }
}