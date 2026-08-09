import { Routes } from '@angular/router';

export const AUTH_STANDALONE_ROUTES: Routes = [
  {
    path: 'tam-thoi-khong-the-xac-thuc',
    title: 'Tạm thời chưa thể xác minh phiên - TruyenHub',
    loadComponent: () =>
      import('../features/account/auth/pages/auth-temporarily-unavailable-page/auth-temporarily-unavailable-page.component').then(
        (module) => module.AuthTemporarilyUnavailablePageComponent,
      ),
  },
];

export const AUTH_ROUTES: Routes = [
  {
    path: 'dang-nhap',
    title: 'Đăng nhập - TruyenHub',
    loadComponent: () =>
      import('../features/account/auth/pages/login-required-page/login-required-page.component').then(
        (module) => module.LoginRequiredPageComponent,
      ),
  },
  {
    path: 'khong-co-quyen',
    title: 'Không có quyền truy cập - TruyenHub',
    loadComponent: () =>
      import('../features/account/auth/pages/access-denied-page/access-denied-page.component').then(
        (module) => module.AccessDeniedPageComponent,
      ),
  },
  {
    path: 'verify-email',
    title: 'Xác minh email - TruyenHub',
    loadComponent: () =>
      import('../features/account/auth/pages/verify-email-page/verify-email-page.component').then(
        (module) => module.VerifyEmailPageComponent,
      ),
  },
  {
    path: 'oauth/callback',
    title: 'Đang đăng nhập - TruyenHub',
    loadComponent: () =>
      import('../features/account/auth/pages/oauth-callback-page/oauth-callback-page.component').then(
        (module) => module.OAuthCallbackPageComponent,
      ),
  },
  {
    path: 'forgot-password',
    title: 'Khôi phục mật khẩu - TruyenHub',
    data: { authActionMode: 'forgot-password' },
    loadComponent: () =>
      import('../features/account/forgot-password/pages/forgot-password-page/forgot-password-page.component').then(
        (module) => module.ForgotPasswordPageComponent,
      ),
  },
  {
    path: 'reset-password',
    title: 'Tạo mật khẩu mới - TruyenHub',
    loadComponent: () =>
      import('../features/account/reset-password/pages/reset-password-page/reset-password-page.component').then(
        (module) => module.ResetPasswordPageComponent,
      ),
  },
  {
    path: 'change-email/confirm',
    title: 'Xác nhận email mới - TruyenHub',
    data: { authActionMode: 'confirm-email-change' },
    loadComponent: () =>
      import('../features/account/email-confirmation/pages/email-confirmation-page/email-confirmation-page.component').then(
        (module) => module.EmailConfirmationPageComponent,
      ),
  },
];
