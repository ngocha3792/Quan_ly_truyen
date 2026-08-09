import { Routes } from '@angular/router';

import { authenticatedGuard } from '../core/auth/authenticated.guard';
import { AUTH_PERMISSIONS } from '../core/auth/authorization.models';
import { permissionGuard } from '../core/auth/permission.guard';

const authorApplicationGuards = [
  authenticatedGuard,
  permissionGuard(AUTH_PERMISSIONS.AUTHOR_APPLICATION_REVIEW),
];

export const ADMIN_ROUTES: Routes = [
  {
    path: 'admin/author-applications',
    title: 'Xét duyệt hồ sơ tác giả - TruyenHub',
    canActivate: authorApplicationGuards,
    loadComponent: () =>
      import('../features/admin/author-applications/pages/list/admin-author-application-list-page.component').then(
        (module) => module.AdminAuthorApplicationListPageComponent,
      ),
  },
  {
    path: 'admin/author-applications/:applicationId',
    title: 'Chi tiết hồ sơ tác giả - TruyenHub',
    canActivate: authorApplicationGuards,
    loadComponent: () =>
      import('../features/admin/author-applications/pages/detail/admin-author-application-detail-page.component').then(
        (module) => module.AdminAuthorApplicationDetailPageComponent,
      ),
  },
];
