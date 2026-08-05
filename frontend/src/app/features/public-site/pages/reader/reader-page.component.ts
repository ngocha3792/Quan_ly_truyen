import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicSiteIconComponent } from '../../components/public-site-icon/public-site-icon.component';
import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { ButtonDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-reader-page',
  standalone: true,
  imports: [PublicSiteIconComponent, RouterLink, ButtonDirective],
  templateUrl: './reader-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicReaderPageComponent extends PublicSiteViewModel {}
