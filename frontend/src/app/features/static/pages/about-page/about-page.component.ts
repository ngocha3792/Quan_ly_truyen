import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'app-about-page',
    standalone: true,
    templateUrl: './about-page.component.html',
    styleUrls: ['./about-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPageComponent { }