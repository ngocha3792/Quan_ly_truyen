import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'auth/login',
    title: 'Đăng nhập | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/auth-page/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: 'auth/register',
    title: 'Đăng ký | QuanLyTruyen',
    loadComponent: () =>
      import('./pages/auth-page/auth-page.component').then((module) => module.AuthPageComponent),
  },
];
