import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { PublicLayoutComponent } from '../../../../layouts/public-layout/public-layout.component';
import { PublicSiteFacade } from '../../state/public-site.facade';
import { PUBLIC_NAVIGATION } from '../../config/public-navigation.config';

@Component({
  selector: 'app-public-site-layout',
  standalone: true,
  imports: [PublicLayoutComponent],
  providers: [PublicSiteFacade],
  templateUrl: './public-site-layout.component.html',
  styleUrls: ['../../styles/public-site.pages.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSiteLayoutComponent {
  readonly navigation = PUBLIC_NAVIGATION;
}
