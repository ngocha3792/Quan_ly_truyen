import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthorSuitePageBase } from './author-suite-page.base';

@Component({
  selector: 'app-author-suite-stories-view',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './author-suite-page.stories-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuiteStoriesViewComponent extends AuthorSuitePageBase {}
