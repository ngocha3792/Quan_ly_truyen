import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(
        (module) => module.AuthLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        title: 'Đăng nhập | QuanLyTruyen',
        loadComponent: () =>
          import('./pages/login/login-page.component').then((module) => module.LoginPageComponent),
      },
      {
        path: 'register',
        title: 'Đăng ký | QuanLyTruyen',
        loadComponent: () =>
          import('./pages/register/register-page.component').then(
            (module) => module.RegisterPageComponent,
          ),
      },
    ],
  },
];
