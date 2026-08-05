import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicSitePageBase } from './public-site-page.base';

@Component({
  selector: 'app-public-site-comments-view',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-site-page.comments-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSiteCommentsViewComponent extends PublicSitePageBase {}
