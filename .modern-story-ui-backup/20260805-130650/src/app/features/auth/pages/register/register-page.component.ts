import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthIconComponent } from '../../components/auth-icon/auth-icon.component';
import { AuthBenefit } from '../../models/auth-benefit.model';
import { AuthBenefitsComponent } from '../../components/auth-benefits/auth-benefits.component';
import { AuthCardComponent } from '../../components/auth-card/auth-card.component';
import { SocialAuthButtonsComponent } from '../../components/social-auth-buttons/social-auth-buttons.component';

import { ButtonDirective } from '../../../../shared/ui';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    RouterLink,
    AuthIconComponent,
    AuthBenefitsComponent,
    AuthCardComponent,
    SocialAuthButtonsComponent,
    ButtonDirective,
  ],
  templateUrl: './register-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly acceptedTerms = signal(true);
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

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }
  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((visible) => !visible);
  }
}
