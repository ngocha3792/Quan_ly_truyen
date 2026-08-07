import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { IconName } from '../../../../../shared/components/icon/icon.component';

import { AccountActionCardComponent } from '../../components/account-action-card/account-action-card.component';
import { AccountOverviewCardComponent } from '../../components/account-overview-card/account-overview-card.component';

import { AccountStore } from '../../data/account.store';

interface AccountQuickAction {
  readonly title: string;
  readonly description: string;
  readonly linkLabel: string;
  readonly route: string;
  readonly icon: IconName;
  readonly tone: 'purple' | 'orange' | 'blue' | 'green';
}

@Component({
  selector: 'app-account-overview-page',
  standalone: true,
  imports: [AccountOverviewCardComponent, AccountActionCardComponent],
  templateUrl: './account-overview-page.component.html',
  styleUrl: './account-overview-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountOverviewPageComponent implements OnInit {
  protected readonly store = inject(AccountStore);

  protected readonly quickActions: readonly AccountQuickAction[] = [
    {
      title: 'Thông tin cá nhân',
      description: 'Cập nhật tên hiển thị, email và thông tin cá nhân của bạn.',
      linkLabel: 'Cập nhật ngay',
      route: '/tai-khoan/thong-tin-ca-nhan',
      icon: 'user',
      tone: 'purple',
    },
    {
      title: 'Bảo mật',
      description: 'Đổi mật khẩu và quản lý các tùy chọn bảo mật.',
      linkLabel: 'Đổi mật khẩu',
      route: '/tai-khoan/bao-mat',
      icon: 'lock',
      tone: 'orange',
    },
    {
      title: 'Thiết bị đăng nhập',
      description: 'Quản lý các thiết bị đã đăng nhập vào tài khoản.',
      linkLabel: 'Quản lý thiết bị',
      route: '/tai-khoan/thiet-bi',
      icon: 'monitor',
      tone: 'blue',
    },
    {
      title: 'Lịch sử hoạt động',
      description: 'Xem các hoạt động gần đây trên tài khoản của bạn.',
      linkLabel: 'Xem lịch sử',
      route: '/tai-khoan/hoat-dong',
      icon: 'history',
      tone: 'green',
    },
  ];

  ngOnInit(): void {
    this.store.load();
  }
}
