import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuiteViewModel } from '../../state/author-suite-view-model';

import { CardDirective, DataTableDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-author-revenue-page',
  standalone: true,
  imports: [CardDirective, DataTableDirective],
  templateUrl: './revenue-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorRevenuePageComponent extends AuthorSuiteViewModel {}
