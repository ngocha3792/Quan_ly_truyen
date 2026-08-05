import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicSiteViewModel } from '../../state/public-site-view-model';

@Component({
  selector: 'app-public-home-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicHomePageComponent extends PublicSiteViewModel {}
