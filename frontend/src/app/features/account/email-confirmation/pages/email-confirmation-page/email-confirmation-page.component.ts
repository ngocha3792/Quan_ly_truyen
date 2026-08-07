
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
    provideEmailConfirmation,
} from '../../data-access/email-confirmation.providers';
import {
    EmailConfirmationStore,
} from '../../data-access/email-confirmation.store';
import {
    EmailConfirmationCardComponent,
} from '../../ui/email-confirmation-card/email-confirmation-card.component';

@Component({
    selector: 'app-email-confirmation-page',
    standalone: true,

    imports: [
        EmailConfirmationCardComponent,
    ],

    providers: [
        ...provideEmailConfirmation(),
        EmailConfirmationStore,
    ],

    templateUrl:
        './email-confirmation-page.component.html',

    styleUrl:
        './email-confirmation-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class EmailConfirmationPageComponent
    implements OnInit {
    private readonly route =
        inject(ActivatedRoute);

    protected readonly store =
        inject(EmailConfirmationStore);

    ngOnInit(): void {
        /*
         * Dùng demo-token làm mặc định để copy code
         * xong truy cập route là thấy giao diện ngay.
         *
         * Khi nối backend thật, có thể bỏ fallback
         * và bắt buộc URL phải chứa token.
         */
        const token =
            this.route.snapshot.queryParamMap.get(
                'token',
            ) ?? 'demo-token';

        this.store.confirm(token);
    }
}