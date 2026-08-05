import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuiteViewModel } from '../../state/author-suite-view-model';

import { CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-author-analytics-page',
  standalone: true,
  imports: [CardDirective],
  templateUrl: './analytics-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorAnalyticsPageComponent extends AuthorSuiteViewModel {}
