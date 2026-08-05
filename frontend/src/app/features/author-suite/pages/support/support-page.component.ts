import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuiteViewModel } from '../../state/author-suite-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-author-support-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective],
  templateUrl: './support-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSupportPageComponent extends AuthorSuiteViewModel {}
