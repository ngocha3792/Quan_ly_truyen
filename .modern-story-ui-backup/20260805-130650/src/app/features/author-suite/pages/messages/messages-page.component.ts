import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuiteViewModel } from '../../state/author-suite-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-author-messages-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective],
  templateUrl: './messages-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorMessagesPageComponent extends AuthorSuiteViewModel {}
