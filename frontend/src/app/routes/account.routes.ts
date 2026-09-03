import { Routes } from '@angular/router';
import { appPageTitle } from '../core/config/app-identity.constants';

import { authenticatedGuard } from '../core/auth/authenticated.guard';
import { AUTH_PERMISSIONS } from '../core/auth/authorization.models';
import { permissionGuard } from '../core/auth/permission.guard';

export const ACCOUNT_FEATURE_ROUTES: Routes = [
  {
    path: 'tai-khoan',
    canActivate: [authenticatedGuard],
    loadChildren: () =>
      import('../features/account/profile/account.routes').then((module) => module.ACCOUNT_ROUTES),
  },
  {
    path: 'lich-su',
    title: appPageTitle('Lịch sử đọc'),
    canActivate: [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.READING_HISTORY_MANAGE_OWN)],
    loadComponent: () =>
      import('../features/account/reading-history/pages/reading-history-page/reading-history-page.component').then(
        (module) => module.ReadingHistoryPageComponent,
      ),
  },
  {
    path: 'dang-theo-doi',
    title: appPageTitle('Tác giả đang theo dõi'),
    canActivate: [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.FOLLOW_MANAGE_OWN)],
    loadComponent: () =>
      import('../features/account/following/pages/following-page/following-page.component').then(
        (module) => module.FollowingPageComponent,
      ),
  },
  {
    path: 'thong-bao',
    title: appPageTitle('Thông báo'),
    canActivate: [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.NOTIFICATION_MANAGE_OWN)],
    loadComponent: () =>
      import('../features/account/notifications/pages/notifications-page/notifications-page.component').then(
        (module) => module.NotificationsPageComponent,
      ),
  },
  {
    path: 'thu-vien',
    title: appPageTitle('Thư viện của tôi'),
    canActivate: [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.LIBRARY_MANAGE_OWN)],
    loadComponent: () =>
      import('../features/account/my-library/pages/my-library-page/my-library-page.component').then(
        (module) => module.MyLibraryPageComponent,
      ),
  },
  {
    path: 'dang-ky-tac-gia',
    title: appPageTitle('Trở thành tác giả'),
    canActivate: [authenticatedGuard, permissionGuard(AUTH_PERMISSIONS.AUTHOR_APPLICATION_CREATE)],
    loadComponent: () =>
      import('../features/account/author-application/pages/author-application-page/author-application-page.component').then(
        (module) => module.AuthorApplicationPageComponent,
      ),
  },
];
