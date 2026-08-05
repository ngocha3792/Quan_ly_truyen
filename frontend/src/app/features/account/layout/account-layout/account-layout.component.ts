import {
    ChangeDetectionStrategy,
    Component,
    inject,
} from '@angular/core';

import {
    Router,
    RouterOutlet,
} from '@angular/router';

import { AuthStore } from '../../../../core/auth/auth.store';

import { AccountSidebarComponent } from '../../components/account-sidebar/account-sidebar.component';

@Component({
    selector: 'app-account-layout',
    standalone: true,
    imports: [
        RouterOutlet,
        AccountSidebarComponent,
    ],
    templateUrl:
        './account-layout.component.html',
    styleUrl:
        './account-layout.component.scss',
    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class AccountLayoutComponent {
    private readonly router = inject(Router);

    protected readonly auth = inject(AuthStore);

    protected logout(): void {
        this.auth.logout();
        void this.router.navigateByUrl('/');
    }
}