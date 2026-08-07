
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
} from '@angular/core';
import {
    ActivatedRoute,
} from '@angular/router';

import {
    provideResetPassword,
} from '../../data-access/reset-password.providers';
import {
    ResetPasswordStore,
} from '../../data-access/reset-password.store';
import {
    ResetPasswordCardComponent,
} from '../../ui/reset-password-card/reset-password-card.component';

@Component({
    selector: 'app-reset-password-page',
    standalone: true,

    imports: [
        ResetPasswordCardComponent,
    ],

    providers: [
        ...provideResetPassword(),
        ResetPasswordStore,
    ],

    templateUrl:
        './reset-password-page.component.html',

    styleUrl:
        './reset-password-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPageComponent
    implements OnInit {
    private readonly route =
        inject(ActivatedRoute);

    protected readonly store =
        inject(ResetPasswordStore);

    ngOnInit(): void {
        /*
         * Fallback này giúp truy cập route trực tiếp
         * vẫn xem được giao diện demo.
         *
         * Khi nối backend thật, bỏ fallback và bắt
         * buộc URL phải có token.
         */
        const token =
            this.route.snapshot.queryParamMap.get(
                'token',
            ) ?? 'demo-reset-token';

        this.store.initialize(token);
    }
}