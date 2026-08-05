import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuiteViewModel } from '../../state/author-suite-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-author-community-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective],
  templateUrl: './community-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorCommunityPageComponent extends AuthorSuiteViewModel {}
