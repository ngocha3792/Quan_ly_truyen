import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthorSuitePageBase } from './author-suite-page.base';

@Component({
  selector: 'app-author-suite-overview-view',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './author-suite-page.overview-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuiteOverviewViewComponent extends AuthorSuitePageBase {}
