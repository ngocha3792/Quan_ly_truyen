
import {
    ChangeDetectionStrategy,
    Component,
    inject,
} from '@angular/core';

import { provideForgotPassword } from '../../data-access/forgot-password.providers';
import { ForgotPasswordStore } from '../../data-access/forgot-password.store';
import { ForgotPasswordCardComponent } from '../../ui/forgot-password-card/forgot-password-card.component';

@Component({
    selector: 'app-forgot-password-page',
    standalone: true,

    imports: [
        ForgotPasswordCardComponent,
    ],

    providers: [
        ...provideForgotPassword(),
        ForgotPasswordStore,
    ],

    templateUrl:
        './forgot-password-page.component.html',

    styleUrl:
        './forgot-password-page.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPageComponent {
    protected readonly store =
        inject(ForgotPasswordStore);
}