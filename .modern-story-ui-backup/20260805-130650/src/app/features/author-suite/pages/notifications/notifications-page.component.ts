import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuiteViewModel } from '../../state/author-suite-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-author-notifications-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective],
  templateUrl: './notifications-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorNotificationsPageComponent extends AuthorSuiteViewModel {}
