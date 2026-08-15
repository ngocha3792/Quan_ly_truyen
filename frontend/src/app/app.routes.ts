import { Routes } from '@angular/router';

import { provideHome } from './features/public/home/data-access/home.providers';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { ACCOUNT_FEATURE_ROUTES } from './routes/account.routes';
import { ADMIN_ROUTES } from './routes/admin.routes';
import { AUTH_ROUTES, AUTH_STANDALONE_ROUTES } from './routes/auth.routes';
import { AUTHOR_STUDIO_LEGACY_ROUTES, AUTHOR_STUDIO_ROUTES } from './routes/author-studio.routes';
import { PUBLIC_ROUTES } from './routes/public.routes';

export const routes: Routes = [
  ...AUTHOR_STUDIO_ROUTES,
  ...AUTH_STANDALONE_ROUTES,
  {
    path: '',
    component: AppShellComponent,
    // AppHeader also consumes HomeRepository, so the provider belongs to the shell.
    providers: provideHome(),
    children: [
      ...PUBLIC_ROUTES,
      ...AUTH_ROUTES,
      ...ACCOUNT_FEATURE_ROUTES,
      ...ADMIN_ROUTES,
      ...AUTHOR_STUDIO_LEGACY_ROUTES,
    ],
  },
  { path: '**', redirectTo: '' },
];
