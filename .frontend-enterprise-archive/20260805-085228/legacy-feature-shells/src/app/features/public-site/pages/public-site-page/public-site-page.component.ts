import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicSiteIconComponent } from '../../../../shared/ui/public-site-icon/public-site-icon.component';

import { PublicSitePageBase } from './public-site-page.base';
import { PublicSiteHomeViewComponent } from './public-site-page.home-view.component';
import { PublicSiteGenresViewComponent } from './public-site-page.genres-view.component';
import { PublicSiteSearchViewComponent } from './public-site-page.search-view.component';
import { PublicSiteRankingsViewComponent } from './public-site-page.rankings-view.component';
import { PublicSiteStoryViewComponent } from './public-site-page.story-view.component';
import { PublicSiteChaptersViewComponent } from './public-site-page.chapters-view.component';
import { PublicSiteReaderViewComponent } from './public-site-page.reader-view.component';
import { PublicSiteCommentsViewComponent } from './public-site-page.comments-view.component';
import { PublicSiteAuthorViewComponent } from './public-site-page.author-view.component';
import { PublicSiteAboutViewComponent } from './public-site-page.about-view.component';
import { PublicSiteGuideViewComponent } from './public-site-page.guide-view.component';
import { PublicSiteNotFoundViewComponent } from './public-site-page.notfound-view.component';

@Component({
  selector: 'app-public-site-page',
  standalone: true,
  imports: [
    PublicSiteIconComponent,
    RouterLink,
    PublicSiteHomeViewComponent,
    PublicSiteGenresViewComponent,
    PublicSiteSearchViewComponent,
    PublicSiteRankingsViewComponent,
    PublicSiteStoryViewComponent,
    PublicSiteChaptersViewComponent,
    PublicSiteReaderViewComponent,
    PublicSiteCommentsViewComponent,
    PublicSiteAuthorViewComponent,
    PublicSiteAboutViewComponent,
    PublicSiteGuideViewComponent,
    PublicSiteNotFoundViewComponent,
  ],
  templateUrl: './public-site-page.component.html',
  styleUrls: ['./public-site-page.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSitePageComponent extends PublicSitePageBase {}
