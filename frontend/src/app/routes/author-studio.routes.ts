import { Routes } from '@angular/router';

import { authenticatedGuard } from '../core/auth/authenticated.guard';
import { AUTH_PERMISSIONS, AUTH_ROLES } from '../core/auth/authorization.models';
import { permissionGuard } from '../core/auth/permission.guard';
import { roleGuard } from '../core/auth/role.guard';

export const AUTHOR_STUDIO_ROUTES: Routes = [
  {
    path: 'author-studio',
    canActivate: [
      authenticatedGuard,
      roleGuard(AUTH_ROLES.AUTHOR),
      permissionGuard(AUTH_PERMISSIONS.STORY_CREATE),
    ],
    loadComponent: () =>
      import('../features/author-portal/author-studio/pages/author-studio-shell/author-studio-shell.component').then(
        (module) => module.AuthorStudioShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tong-quan' },
      {
        path: 'tong-quan',
        title: 'Tổng quan tác giả - TruyenHub',
        loadComponent: () =>
          import('../features/author-portal/author-studio/pages/author-dashboard-page/author-dashboard-page.component').then(
            (module) => module.AuthorDashboardPageComponent,
          ),
      },
      { path: '**', redirectTo: 'tong-quan' },
    ],
  },
];

export const AUTHOR_STUDIO_LEGACY_ROUTES: Routes = [
  { path: 'tac-gia-studio', pathMatch: 'full', redirectTo: '/author-studio' },
];
