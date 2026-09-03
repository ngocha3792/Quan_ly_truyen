import { Routes } from '@angular/router';
import { appPageTitle } from '../core/config/app-identity.constants';

export const AUTH_STANDALONE_ROUTES: Routes = [
  {
    path: 'tam-thoi-khong-the-xac-thuc',
    title: appPageTitle('Tạm thời chưa thể xác minh phiên'),
    loadComponent: () =>
      import('../features/account/auth/pages/auth-temporarily-unavailable-page/auth-temporarily-unavailable-page.component').then(
        (module) => module.AuthTemporarilyUnavailablePageComponent,
      ),
  },
];

export const AUTH_ROUTES: Routes = [
  {
    path: 'dang-nhap',
    title: appPageTitle('Đăng nhập'),
    loadComponent: () =>
      import('../features/account/auth/pages/login-required-page/login-required-page.component').then(
        (module) => module.LoginRequiredPageComponent,
      ),
  },
  {
    path: 'khong-co-quyen',
    title: appPageTitle('Không có quyền truy cập'),
    loadComponent: () =>
      import('../features/account/auth/pages/access-denied-page/access-denied-page.component').then(
        (module) => module.AccessDeniedPageComponent,
      ),
  },
  {
    path: 'verify-email',
    title: appPageTitle('Xác minh email'),
    loadComponent: () =>
      import('../features/account/auth/pages/verify-email-page/verify-email-page.component').then(
        (module) => module.VerifyEmailPageComponent,
      ),
  },
  {
    path: 'oauth/callback',
    title: appPageTitle('Đang đăng nhập'),
    loadComponent: () =>
      import('../features/account/auth/pages/oauth-callback-page/oauth-callback-page.component').then(
        (module) => module.OAuthCallbackPageComponent,
      ),
  },
  {
    path: 'forgot-password',
    title: appPageTitle('Khôi phục mật khẩu'),
    data: { authActionMode: 'forgot-password' },
    loadComponent: () =>
      import('../features/account/forgot-password/pages/forgot-password-page/forgot-password-page.component').then(
        (module) => module.ForgotPasswordPageComponent,
      ),
  },
  {
    path: 'reset-password',
    title: appPageTitle('Tạo mật khẩu mới'),
    loadComponent: () =>
      import('../features/account/reset-password/pages/reset-password-page/reset-password-page.component').then(
        (module) => module.ResetPasswordPageComponent,
      ),
  },
  {
    path: 'change-email/confirm',
    title: appPageTitle('Xác nhận email mới'),
    data: { authActionMode: 'confirm-email-change' },
    loadComponent: () =>
      import('../features/account/email-confirmation/pages/email-confirmation-page/email-confirmation-page.component').then(
        (module) => module.EmailConfirmationPageComponent,
      ),
  },
];
