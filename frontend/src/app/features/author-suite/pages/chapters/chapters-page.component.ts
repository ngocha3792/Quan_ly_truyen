import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuiteViewModel } from '../../state/author-suite-view-model';

import { ButtonDirective, CardDirective, DataTableDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-author-chapters-page',
  standalone: true,
  imports: [ButtonDirective, CardDirective, DataTableDirective],
  templateUrl: './chapters-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorChaptersPageComponent extends AuthorSuiteViewModel {}
