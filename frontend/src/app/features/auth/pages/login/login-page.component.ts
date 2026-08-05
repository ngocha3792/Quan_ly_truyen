import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthIconComponent } from '../../components/auth-icon/auth-icon.component';
import { AuthBenefit } from '../../models/auth-benefit.model';
import { AuthBenefitsComponent } from '../../components/auth-benefits/auth-benefits.component';
import { AuthCardComponent } from '../../components/auth-card/auth-card.component';
import { SocialAuthButtonsComponent } from '../../components/social-auth-buttons/social-auth-buttons.component';

import { ButtonDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    RouterLink,
    AuthIconComponent,
    AuthBenefitsComponent,
    AuthCardComponent,
    SocialAuthButtonsComponent,
    ButtonDirective,
  ],
  templateUrl: './login-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  readonly showPassword = signal(false);
  readonly rememberMe = signal(true);
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
}
