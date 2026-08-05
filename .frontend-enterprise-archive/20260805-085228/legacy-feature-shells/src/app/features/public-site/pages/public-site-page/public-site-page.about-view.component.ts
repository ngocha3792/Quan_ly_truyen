import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicSiteIconComponent } from '../../../../shared/ui/public-site-icon/public-site-icon.component';
import { PublicSitePageBase } from './public-site-page.base';

@Component({
  selector: 'app-public-site-about-view',
  standalone: true,
  imports: [PublicSiteIconComponent, RouterLink],
  templateUrl: './public-site-page.about-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSiteAboutViewComponent extends PublicSitePageBase {}
