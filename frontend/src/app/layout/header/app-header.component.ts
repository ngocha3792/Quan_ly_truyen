import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { AuthDialogComponent } from '../../features/account/auth/ui/auth-dialog/auth-dialog.component';
import { HomeRepository } from '../../features/public/home/data-access/home.repository';
import { Story } from '../../features/public/home/domain/home.models';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

interface NavItem {
  readonly label: string;
  readonly route: string;
}

@Component({
  selector: 'app-header',
  standalone: true,

  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    BrandLogoComponent,
    IconComponent,
    AuthDialogComponent,
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  private readonly repository = inject(HomeRepository);

  private readonly router = inject(Router);

  protected readonly auth = inject(AuthStore);

  protected readonly query = signal('');

  protected readonly searchOpen = signal(false);

  protected readonly mobileOpen = signal(false);

  protected readonly profileOpen = signal(false);

  protected readonly notificationsOpen = signal(false);

  protected readonly authOpen = signal(false);

  /**
   * Tạm thời dùng mock.
   * Sau này thay bằng giá trị từ notification store/API.
   */
  protected readonly notificationUnreadCount = signal(2);

  protected readonly navItems: readonly NavItem[] = [
    {
      label: 'Trang chủ',
      route: '/',
    },
    {
      label: 'Danh sách',
      route: '/danh-sach',
    },
    {
      label: 'Thể loại',
      route: '/the-loai',
    },
    {
      label: 'Xếp hạng',
      route: '/xep-hang',
    },
    {
      label: 'Cập nhật',
      route: '/cap-nhat',
    },
    {
      label: 'Tác giả',
      route: '/tac-gia',
    },
  ];

  protected readonly suggestions = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) => {
        const normalizedQuery = query.trim();

        if (!normalizedQuery) {
          return of<readonly Story[]>([]);
        }

        return this.repository.searchStories(normalizedQuery);
      }),
    ),
    {
      initialValue: [] as readonly Story[],
    },
  );

  /**
   * Mở hoặc đóng menu mobile.
   * Khi mở menu mobile sẽ đóng toàn bộ popover khác.
   */
  protected toggleMobile(): void {
    const nextState = !this.mobileOpen();

    this.closeHeaderPopovers();
    this.searchOpen.set(false);
    this.mobileOpen.set(nextState);
  }

  /**
   * Đóng menu mobile sau khi chọn một route.
   */
  protected closeMobileMenu(): void {
    this.mobileOpen.set(false);
    this.closeHeaderPopovers();
  }

  /**
   * Mở lớp tìm kiếm và đóng các menu đang mở.
   */
  protected showSearch(): void {
    this.closeHeaderPopovers();
    this.mobileOpen.set(false);
    this.searchOpen.set(true);
  }

  /**
   * Đóng tìm kiếm và xóa từ khóa.
   */
  protected hideSearch(): void {
    this.searchOpen.set(false);
    this.query.set('');
  }

  /**
   * Điều hướng tới kết quả đầu tiên khi nhấn Enter.
   */
  protected submitSearch(): void {
    const normalizedQuery = this.query().trim();

    if (!normalizedQuery) {
      return;
    }

    const firstStory = this.suggestions()[0];

    if (firstStory) {
      void this.router.navigate(['/truyen', firstStory.slug]);

      this.hideSearch();
      return;
    }

    /**
     * Không có gợi ý thì chuyển sang trang danh sách
     * và truyền từ khóa tìm kiếm bằng query param.
     */
    void this.router.navigate(['/danh-sach'], {
      queryParams: {
        q: normalizedQuery,
      },
    });

    this.hideSearch();
  }

  /**
   * Được gọi sau khi người dùng chọn một gợi ý tìm kiếm.
   */
  protected selectSuggestion(): void {
    this.searchOpen.set(false);
    this.query.set('');
  }

  /**
   * Mở hoặc đóng menu hồ sơ.
   */
  protected toggleProfile(): void {
    const nextState = !this.profileOpen();

    this.notificationsOpen.set(false);
    this.mobileOpen.set(false);
    this.profileOpen.set(nextState);
  }

  protected closeProfile(): void {
    this.profileOpen.set(false);
  }

  /**
   * Mở hoặc đóng popover thông báo.
   */
  protected toggleNotifications(): void {
    const nextState = !this.notificationsOpen();

    this.profileOpen.set(false);
    this.mobileOpen.set(false);
    this.notificationsOpen.set(nextState);
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  /**
   * Đóng menu profile và thông báo.
   */
  protected closeHeaderPopovers(): void {
    this.profileOpen.set(false);
    this.notificationsOpen.set(false);
  }

  /**
   * Mở dialog đăng nhập.
   */
  protected openAuth(): void {
    this.closeHeaderPopovers();
    this.mobileOpen.set(false);
    this.searchOpen.set(false);
    this.authOpen.set(true);
  }

  /**
   * Đăng xuất và đóng toàn bộ menu.
   */
  protected logout(): void {
    this.auth.logout();

    this.profileOpen.set(false);
    this.notificationsOpen.set(false);
    this.mobileOpen.set(false);
  }
}
