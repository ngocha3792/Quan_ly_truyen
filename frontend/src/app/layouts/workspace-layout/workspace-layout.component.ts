import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  ViewEncapsulation,
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
import {
  AppLogoComponent,
  AvatarComponent,
  ButtonDirective,
  PageHeaderComponent,
  SearchBoxComponent,
} from '../../shared/ui';

export interface WorkspaceNavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: string;
  readonly exact?: boolean;
}

interface WorkspaceRouteMeta {
  readonly title: string;
  readonly description: string;
}

@Component({
  selector: 'app-workspace-layout',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AppLogoComponent,
    AvatarComponent,
    ButtonDirective,
    PageHeaderComponent,
    SearchBoxComponent,
  ],
  templateUrl: './workspace-layout.component.html',
  styleUrls: ['./workspace-layout.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @Input() variant: 'admin' | 'author' | 'account' = 'admin';
  @Input() brandCaption = '';
  @Input() defaultTitle = '';
  @Input() navigation: readonly WorkspaceNavigationItem[] = [];
  @Input() avatarSrc = '';
  @Input() userName = '';
  @Input() userRole = '';
  @Input() notificationCount = 0;
  @Input() searchPlaceholder = 'Tìm kiếm...';
  @Input() primaryActionLabel = '';
  @Input() primaryActionRoute = '';

  readonly sidebarOpen = signal(false);
  readonly routeMeta = signal<WorkspaceRouteMeta>({ title: '', description: '' });

  ngOnInit(): void {
    this.refreshRouteMeta();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.sidebarOpen.set(false);
        this.refreshRouteMeta();
      });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private refreshRouteMeta(): void {
    let activeRoute = this.route;
    while (activeRoute.firstChild) activeRoute = activeRoute.firstChild;
    const data = activeRoute.snapshot.data as Record<string, unknown>;
    this.routeMeta.set({
      title: typeof data['pageTitle'] === 'string' ? data['pageTitle'] : this.defaultTitle,
      description: typeof data['pageDescription'] === 'string' ? data['pageDescription'] : '',
    });
  }
}
