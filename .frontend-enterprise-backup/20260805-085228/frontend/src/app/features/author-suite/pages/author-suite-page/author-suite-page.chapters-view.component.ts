import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuitePageBase } from './author-suite-page.base';

@Component({
  selector: 'app-author-suite-chapters-view',
  standalone: true,
  imports: [],
  templateUrl: './author-suite-page.chapters-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuiteChaptersViewComponent extends AuthorSuitePageBase {}
