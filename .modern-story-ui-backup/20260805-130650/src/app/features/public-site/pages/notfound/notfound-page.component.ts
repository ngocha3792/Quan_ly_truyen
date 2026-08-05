import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { ButtonDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-notfound-page',
  standalone: true,
  imports: [RouterLink, ButtonDirective],
  templateUrl: './notfound-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicNotFoundPageComponent extends PublicSiteViewModel {}
