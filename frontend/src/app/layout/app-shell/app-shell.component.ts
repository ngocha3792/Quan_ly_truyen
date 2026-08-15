import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
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

    const subscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncRouteSeo());

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  private syncRouteSeo(): void {
    let activeRoute = this.route;

    while (activeRoute.firstChild) {
      activeRoute = activeRoute.firstChild;
    }

    const snapshot = activeRoute.snapshot;
    const description = snapshot.data['seoDescription'];

    if (typeof description !== 'string' || !description.trim()) {
      return;
    }

    const title = typeof snapshot.title === 'string'
      ? snapshot.title
      : 'TruyenHub - Đọc truyện online';
    const canonicalPath = this.router.url.split(/[?#]/, 1)[0] || '/';
    const hasSearchQuery = Boolean(snapshot.queryParamMap.get('q')?.trim());

    this.seo.apply({
      title,
      description,
      canonicalPath,
      type: 'website',
      robots: hasSearchQuery ? 'noindex,follow' : undefined,
    });
  }
}
