import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicSiteIconComponent } from '../../../../shared/ui/public-site-icon/public-site-icon.component';
import { PublicSitePageBase } from './public-site-page.base';

@Component({
  selector: 'app-public-site-author-view',
  standalone: true,
  imports: [PublicSiteIconComponent, RouterLink],
  templateUrl: './public-site-page.author-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSiteAuthorViewComponent extends PublicSitePageBase {}
