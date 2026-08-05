import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicSitePageBase } from './public-site-page.base';

@Component({
  selector: 'app-public-site-chapters-view',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-site-page.chapters-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSiteChaptersViewComponent extends PublicSitePageBase {}
