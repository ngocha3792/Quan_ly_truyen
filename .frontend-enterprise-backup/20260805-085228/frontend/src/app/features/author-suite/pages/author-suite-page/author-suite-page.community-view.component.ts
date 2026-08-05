import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuitePageBase } from './author-suite-page.base';

@Component({
  selector: 'app-author-suite-community-view',
  standalone: true,
  imports: [],
  templateUrl: './author-suite-page.community-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuiteCommunityViewComponent extends AuthorSuitePageBase {}
