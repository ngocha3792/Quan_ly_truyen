import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicSitePageBase } from './public-site-page.base';

@Component({
  selector: 'app-public-site-genres-view',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-site-page.genres-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSiteGenresViewComponent extends PublicSitePageBase {}
