import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PublicSiteIconComponent } from '../../../../shared/ui/public-site-icon/public-site-icon.component';
import { PublicSitePageBase } from './public-site-page.base';

@Component({
  selector: 'app-public-site-guide-view',
  standalone: true,
  imports: [PublicSiteIconComponent],
  templateUrl: './public-site-page.guide-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSiteGuideViewComponent extends PublicSitePageBase {}
