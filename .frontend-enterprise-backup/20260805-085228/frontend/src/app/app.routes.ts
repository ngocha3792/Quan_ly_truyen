import { Routes } from '@angular/router';
import { PUBLIC_SITE_ROUTES } from './features/public-site/public-site.routes';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { ACCOUNT_CENTER_ROUTES } from './features/account-center/account-center.routes';
import { AUTHOR_SUITE_ROUTES } from './features/author-suite/author-suite.routes';
import { ADMIN_CENTER_ROUTES } from './features/admin-center/admin-center.routes';

export const APP_ROUTES: Routes = [
  ...PUBLIC_SITE_ROUTES,
  ...AUTH_ROUTES,
  ...ACCOUNT_CENTER_ROUTES,
  ...AUTHOR_SUITE_ROUTES,
  ...ADMIN_CENTER_ROUTES,
  { path: '**', redirectTo: '404' },
];

export const routes = APP_ROUTES;
