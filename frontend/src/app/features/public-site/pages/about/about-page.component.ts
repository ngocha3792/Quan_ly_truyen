import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicSiteIconComponent } from '../../components/public-site-icon/public-site-icon.component';
import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-about-page',
  standalone: true,
  imports: [PublicSiteIconComponent, RouterLink, CardDirective],
  templateUrl: './about-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicAboutPageComponent extends PublicSiteViewModel { }
