import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-genres-page',
  standalone: true,
  imports: [RouterLink, CardDirective],
  templateUrl: './genres-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicGenresPageComponent extends PublicSiteViewModel {}
