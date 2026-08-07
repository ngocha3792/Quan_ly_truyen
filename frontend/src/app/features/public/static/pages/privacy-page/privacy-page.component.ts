import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-privacy-page',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './privacy-page.component.html',
    styleUrls: ['./privacy-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent { }