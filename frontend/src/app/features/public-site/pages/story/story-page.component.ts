import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicSiteIconComponent } from '../../components/public-site-icon/public-site-icon.component';
import { PublicSiteViewModel } from '../../state/public-site-view-model';

import { ButtonDirective, CardDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-public-story-page',
  standalone: true,
  imports: [PublicSiteIconComponent, RouterLink, ButtonDirective, CardDirective],
  templateUrl: './story-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicStoryPageComponent extends PublicSiteViewModel {}
