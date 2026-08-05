import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-chapters-page',
  standalone: true,
  imports: [RouterLink, ButtonDirective, CardDirective],
  templateUrl: './chapters-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicChaptersPageComponent extends PublicSiteViewModel {}
