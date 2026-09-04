import { Routes } from '@angular/router';
import { appPageTitle } from '../../../core/config/app-identity.constants';

import { AccountLayoutComponent } from './layout/account-layout/account-layout.component';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    component: AccountLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: appPageTitle('Tổng quan tài khoản'),
        loadComponent: () =>
          import('./pages/account-overview-page/account-overview-page.component').then(
            (module) => module.AccountOverviewPageComponent,
          ),
      },
      {
        path: 'thong-tin-ca-nhan',
        title: appPageTitle('Thông tin cá nhân'),
        loadComponent: () =>
          import('./profile/pages/account-profile-page/account-profile-page.component').then(
            (module) => module.AccountProfilePageComponent,
          ),
      },
      {
        path: 'bao-mat',
        title: appPageTitle('Bảo mật tài khoản'),
        loadComponent: () =>
          import('./security/pages/account-security-page/account-security-page.component').then(
            (module) => module.AccountSecurityPageComponent,
          ),
      },
      {
        path: 'bao-mat/doi-mat-khau',
        title: appPageTitle('Đổi mật khẩu'),

        loadComponent: () =>
          import('./security/features/change-password/change-password-page.component').then(
            (module) => module.ChangePasswordPageComponent,
          ),
      },
      {
        path: 'bao-mat/doi-email',
        title: appPageTitle('Đổi email đăng nhập'),

        loadComponent: () =>
          import('./security/features/change-email/change-email-page.component').then(
            (module) => module.ChangeEmailPageComponent,
          ),
      },
      {
        path: 'bao-mat/xac-thuc-2-lop',
        title: appPageTitle('Xác thực hai lớp'),

        loadComponent: () =>
          import('./security/features/mfa/mfa-settings-page.component').then(
            (module) => module.MfaSettingsPageComponent,
          ),
      },
      {
        path: 'bao-mat/email-khoi-phuc',
        title: appPageTitle('Email khôi phục'),

        loadComponent: () =>
          import('./security/features/recovery-email/recovery-email-page.component').then(
            (module) => module.RecoveryEmailPageComponent,
          ),
      },
      {
        path: 'bao-mat/cau-hoi-bao-mat',
        title: appPageTitle('Câu hỏi bảo mật'),

        loadComponent: () =>
          import('./security/features/security-questions/security-questions-page.component').then(
            (module) => module.SecurityQuestionsPageComponent,
          ),
      },
      {
        path: 'thiet-bi',
        title: appPageTitle('Thiết bị đăng nhập'),

        loadComponent: () =>
          import('./sessions/pages/account-sessions-page/account-sessions-page.component').then(
            (module) => module.AccountSessionsPageComponent,
          ),
      },
      {
        path: 'hoat-dong',
        title: appPageTitle('Lịch sử hoạt động'),

        loadComponent: () =>
          import('./activity/pages/account-activity-page/account-activity-page.component').then(
            (module) => module.AccountActivityPageComponent,
          ),
      },
      {
        path: 'muc-tieu-doc',
        title: appPageTitle('Mục tiêu đọc'),

        loadComponent: () =>
          import('./reading-goal/pages/reading-goal-page/reading-goal-page.component').then(
            (module) => module.ReadingGoalPageComponent,
          ),
      },
    ],
  },
];
