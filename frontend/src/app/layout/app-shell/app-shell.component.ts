import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import {
  APP_DEFAULT_PAGE_TITLE,
  APP_DEFAULT_SEO_DESCRIPTION,
} from '../../core/config/app-identity.constants';
import { SeoService } from '../../core/seo/seo.service';
import { AppFooterComponent } from '../footer/app-footer.component';
import { AppHeaderComponent } from '../header/app-header.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, AppFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent implements OnInit {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.auth.initialize();
    this.syncRouteSeo();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncRouteSeo());
  }

  private syncRouteSeo(): void {
    let activeRoute = this.route;

    while (activeRoute.firstChild) {
      activeRoute = activeRoute.firstChild;
    }

    const snapshot = activeRoute.snapshot;
    const description = snapshot.data['seoDescription'];

    const title = typeof snapshot.title === 'string' ? snapshot.title : APP_DEFAULT_PAGE_TITLE;
    const canonicalPath = this.router.url.split(/[?#]/, 1)[0] || '/';

    if (typeof description !== 'string' || !description.trim()) {
      this.seo.apply({
        title,
        description: APP_DEFAULT_SEO_DESCRIPTION,
        canonicalPath,
        type: 'website',
        robots: 'noindex,nofollow',
      });
      return;
    }

    const hasQueryParameters = snapshot.queryParamMap.keys.length > 0;

    this.seo.apply({
      title,
      description,
      canonicalPath,
      type: 'website',
      robots: hasQueryParameters ? 'noindex,follow' : undefined,
    });
  }
}
