import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppLogoComponent, ButtonDirective, SearchBoxComponent } from '../../shared/ui';

export interface PublicNavigationItem {
  readonly label: string;
  readonly route: string;
  readonly exact?: boolean;
}

interface PublicRouteMeta {
  readonly hideChrome: boolean;
  readonly pageClass: string;
}

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AppLogoComponent,
    ButtonDirective,
    SearchBoxComponent,
  ],
  templateUrl: './public-layout.component.html',
  styleUrls: ['./public-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @Input() navigation: readonly PublicNavigationItem[] = [];
  @Input() searchRoute = '/search';

  readonly mobileNavOpen = signal(false);
  readonly routeMeta = signal<PublicRouteMeta>({ hideChrome: false, pageClass: '' });

  toggleMobileNav(): void {
    this.mobileNavOpen.update((open) => !open);
  }

  ngOnInit(): void {
    this.refreshRouteMeta();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.mobileNavOpen.set(false);
        this.refreshRouteMeta();
      });
  }

  private refreshRouteMeta(): void {
    let activeRoute = this.route;
    while (activeRoute.firstChild) activeRoute = activeRoute.firstChild;
    const data = activeRoute.snapshot.data as Record<string, unknown>;
    this.routeMeta.set({
      hideChrome: data['hideChrome'] === true,
      pageClass: typeof data['pageClass'] === 'string' ? data['pageClass'] : '',
    });
  }
}
