import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { resolveAuthGuardState } from '../../../../../core/auth/auth-guard.util';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { SeoService } from '../../../../../core/seo/seo.service';

import { provideAuthorDetail } from '../../data-access/author-detail.providers';
import { AuthorDetailStore } from '../../data-access/author-detail.store';
import { AuthorBiographyComponent } from '../../ui/author-biography/author-biography.component';
import { AuthorHeroComponent } from '../../ui/author-hero/author-hero.component';
import { AuthorSidebarComponent } from '../../ui/author-sidebar/author-sidebar.component';
import { AuthorStatsComponent } from '../../ui/author-stats/author-stats.component';
import { AuthorTimelineComponent } from '../../ui/author-timeline/author-timeline.component';
import { AuthorWorksComponent } from '../../ui/author-works/author-works.component';

@Component({
  selector: 'app-author-detail-page',
  standalone: true,

  imports: [
    RouterLink,
    AuthorHeroComponent,
    AuthorStatsComponent,
    AuthorBiographyComponent,
    AuthorWorksComponent,
    AuthorTimelineComponent,
    AuthorSidebarComponent,
  ],

  providers: [...provideAuthorDetail(), AuthorDetailStore],

  templateUrl: './author-detail-page.component.html',
  styleUrls: ['./author-detail-page.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly store = inject(AuthorDetailStore);
  private readonly seo = inject(SeoService);

  private readonly seoEffect = effect(() => {
    const view = this.store.view();

    if (!view) return;

    const profile = view.profile;
    const description = (
      profile.biography[0] ||
      profile.headline ||
      `Tác giả ${profile.name} trên TruyenHub.`
    )
      .trim()
      .slice(0, 160);
    const canonicalPath = `/tac-gia/${encodeURIComponent(profile.slug)}`;

    this.seo.apply({
      title: `${profile.name} - Tác giả | TruyenHub`,
      description,
      canonicalPath,
      type: 'profile',
    });

    this.seo.setStructuredData('author', {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: profile.name,
      alternateName: profile.penName,
      description,
      url: this.seo.absoluteUrl(canonicalPath),
      knowsAbout: view.featuredWorks.flatMap((work) => work.genres),
    });
  });

  protected toggleFollow(): void {
    const returnUrl = this.router.url;
    resolveAuthGuardState(this.auth).subscribe((resolution) => {
      if (resolution.kind === 'authenticated') {
        this.store.toggleFollow();
        return;
      }

      void this.router.navigate(
        [resolution.kind === 'anonymous' ? '/dang-nhap' : '/tam-thoi-khong-the-xac-thuc'],
        { queryParams: { returnUrl } },
      );
    });
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.seo.removeStructuredData('author'));

    const slug = this.route.snapshot.paramMap.get('authorSlug') ?? 'nhi-can';

    this.store.load(slug);
  }
}
