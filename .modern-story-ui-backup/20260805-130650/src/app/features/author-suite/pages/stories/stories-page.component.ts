import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthorSuiteViewModel } from '../../state/author-suite-view-model';

import { ButtonDirective, CardDirective, DataTableDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-author-stories-page',
  standalone: true,
  imports: [RouterLink, ButtonDirective, CardDirective, DataTableDirective],
  templateUrl: './stories-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorStoriesPageComponent extends AuthorSuiteViewModel {}
