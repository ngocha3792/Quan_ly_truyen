import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthorSuitePageBase } from './author-suite-page.base';

@Component({
  selector: 'app-author-suite-profile-view',
  standalone: true,
  imports: [],
  templateUrl: './author-suite-page.profile-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorSuiteProfileViewComponent extends AuthorSuitePageBase {}
