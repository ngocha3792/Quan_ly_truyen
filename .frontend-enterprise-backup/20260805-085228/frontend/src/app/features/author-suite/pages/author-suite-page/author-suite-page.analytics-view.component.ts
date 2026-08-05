import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuitePageBase } from './author-suite-page.base';

@Component({
  selector: 'app-author-suite-analytics-view',
  standalone: true,
  imports: [],
  templateUrl: './author-suite-page.analytics-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuiteAnalyticsViewComponent extends AuthorSuitePageBase {}
