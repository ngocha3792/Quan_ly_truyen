import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { HomeRepository } from '../../features/home/data/home.repository';
import { AuthDialogComponent } from '../../features/auth/components/auth-dialog/auth-dialog.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

interface NavItem { readonly label: string; readonly route: string; }

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, BrandLogoComponent, IconComponent, AuthDialogComponent],
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

  protected readonly navItems: readonly NavItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Danh sách', route: '/danh-sach' },
    { label: 'Thể loại', route: '/the-loai' },
    { label: 'Xếp hạng', route: '/xep-hang' },
    { label: 'Cập nhật', route: '/cap-nhat' },
  ];

  protected readonly suggestions = computed(() => this.repository.searchStories(this.query()));

  protected toggleMobile(): void {
    this.mobileOpen.update((value) => !value);
  }

  protected showSearch(): void {
    this.searchOpen.set(true);
    this.profileOpen.set(false);
    this.notificationsOpen.set(false);
  }

  protected hideSearch(): void {
    this.searchOpen.set(false);
  }

  protected submitSearch(): void {
    const first = this.suggestions()[0];
    if (first) {
      void this.router.navigate(['/truyen', first.slug]);
      this.hideSearch();
      this.query.set('');
    }
  }

  protected toggleProfile(): void {
    this.profileOpen.update((value) => !value);
    this.notificationsOpen.set(false);
  }

  protected toggleNotifications(): void {
    this.notificationsOpen.update((value) => !value);
    this.profileOpen.set(false);
  }

  protected openAuth(): void {
    this.authOpen.set(true);
    this.profileOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
    this.profileOpen.set(false);
  }
}
