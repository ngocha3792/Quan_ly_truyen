import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PublicSiteIconComponent } from '../../components/public-site-icon/public-site-icon.component';
import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-guide-page',
  standalone: true,
  imports: [PublicSiteIconComponent, ButtonDirective, CardDirective],
  templateUrl: './guide-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicGuidePageComponent extends PublicSiteViewModel {}
