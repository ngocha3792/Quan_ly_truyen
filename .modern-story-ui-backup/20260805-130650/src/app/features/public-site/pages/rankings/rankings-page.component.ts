import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicSiteIconComponent } from '../../components/public-site-icon/public-site-icon.component';
import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-rankings-page',
  standalone: true,
  imports: [PublicSiteIconComponent, RouterLink, ButtonDirective, CardDirective],
  templateUrl: './rankings-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicRankingsPageComponent extends PublicSiteViewModel {}
