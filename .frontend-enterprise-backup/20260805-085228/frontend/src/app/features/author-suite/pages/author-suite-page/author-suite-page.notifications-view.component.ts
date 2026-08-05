import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuitePageBase } from './author-suite-page.base';

@Component({
  selector: 'app-author-suite-notifications-view',
  standalone: true,
  imports: [],
  templateUrl: './author-suite-page.notifications-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuiteNotificationsViewComponent extends AuthorSuitePageBase {}
