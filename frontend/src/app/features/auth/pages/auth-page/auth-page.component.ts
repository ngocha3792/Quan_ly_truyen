import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AuthIconComponent,
  AuthIconName,
} from '../../../../shared/ui/auth-icon/auth-icon.component';

interface AuthBenefit {
  readonly title: string;
  readonly description: string;
  readonly icon: AuthIconName;
  readonly tone: string;
}

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [AuthIconComponent],
  templateUrl: './auth-page.component.html',
  styleUrls: ['./auth-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly mode = signal<'login' | 'register'>(
    this.route.snapshot.routeConfig?.path?.includes('register')
      ? 'register'
      : 'login',
  );

  readonly isLogin = computed(() => this.mode() === 'login');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly rememberMe = signal(true);
  readonly acceptedTerms = signal(true);
  readonly darkMode = signal(true);

  readonly registerBenefits: readonly AuthBenefit[] = [
    {
      title: 'Miễn phí hoàn toàn',
      description: 'Đăng ký và sử dụng tất cả các tính năng miễn phí',
      icon: 'gift',
      tone: 'violet',
    },
    {
      title: 'Không spam',
      description: 'Chúng tôi cam kết không gửi email rác đến bạn',
      icon: 'shield',
      tone: 'green',
    },
    {
      title: 'Bảo mật thông tin',
      description: 'Thông tin cá nhân của bạn luôn được bảo vệ',
      icon: 'lock',
      tone: 'blue',
    },
    {
      title: 'Cộng đồng lớn mạnh',
      description: 'Tham gia cộng đồng với hàng triệu độc giả khác',
      icon: 'community',
      tone: 'orange',
    },
  ];

  readonly footerBenefits: readonly AuthBenefit[] = [
    {
      title: 'Bảo mật tuyệt đối',
      description: 'Thông tin của bạn được bảo mật với công nghệ tiên tiến',
      icon: 'shield',
      tone: 'violet',
    },
    {
      title: 'Đọc mọi lúc, mọi nơi',
      description: 'Đồng bộ tiến độ trên mọi thiết bị, trải nghiệm liền mạch',
      icon: 'spark',
      tone: 'violet',
    },
    {
      title: 'Cộng đồng độc giả',
      description: 'Kết nối với hàng triệu độc giả đam mê truyện',
      icon: 'community',
      tone: 'pink',
    },
    {
      title: 'Kho truyện khổng lồ',
      description: 'Hàng ngàn truyện hay đang chờ bạn khám phá',
      icon: 'book',
      tone: 'pink',
    },
  ];

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((visible) => !visible);
  }

  toggleTheme(): void {
    this.darkMode.update((enabled) => !enabled);
  }
}
