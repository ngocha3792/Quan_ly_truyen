import { Route } from '@angular/router';

import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

describe('application route composition', () => {
  it('keeps standalone routes outside AppShell and the wildcard last', () => {
    expect(routes.map((route) => route.path)).toEqual([
      'author-studio',
      'admin',
      'tam-thoi-khong-the-xac-thuc',
      '',
      '**',
    ]);

    expect(routes.at(-1)?.redirectTo).toBe('');
  });

  it('preserves every feature route inside AppShell', () => {
    const children = shellRoute().children ?? [];

    expect(children.map((route) => route.path)).toEqual([
      '',
      'truyen/:slug',
      'truyen/:storySlug/chuong/:chapterNumber',
      'danh-sach',
      'the-loai',
      'xep-hang',
      'cap-nhat',
      'gioi-thieu',
      'dieu-khoan',
      'quyen-rieng-tu',
      'cong-dong',
      'tac-gia',
      'tac-gia/:authorSlug',
      'dang-nhap',
      'khong-co-quyen',
      'verify-email',
      'oauth/callback',
      'forgot-password',
      'reset-password',
      'change-email/confirm',
      'tai-khoan',
      'lich-su',
      'dang-theo-doi',
      'thong-bao',
      'thu-vien',
      'dang-ky-tac-gia',
      'tac-gia-studio',
    ]);
  });

  it('retains guards on every private shell route', () => {
    const children = shellRoute().children ?? [];

    const privatePaths = [
      'tai-khoan',
      'lich-su',
      'dang-theo-doi',
      'thong-bao',
      'thu-vien',
      'dang-ky-tac-gia',
    ];

    for (const path of privatePaths) {
      expect(children.find((route) => route.path === path)?.canActivate?.length).toBeGreaterThan(0);
    }
  });

  it('keeps admin as a standalone route (outside AppShell, like author-studio) with its own guard', () => {
    const adminRoute = routes.find((route) => route.path === 'admin');

    expect(adminRoute?.canActivate?.length).toBeGreaterThan(0);
  });

  it('bọc toàn bộ route admin trong AdminShell với guard riêng cho từng mục', () => {
    const adminRoute = routes.find((route) => route.path === 'admin');
    const adminChildren = adminRoute?.children ?? [];

    expect(adminChildren.map((route) => route.path)).toEqual([
      '',
      'audit-logs',
      'audit-logs/:id',
      'reports',
      'reports/:reportId',
      'categories',
      'tags',
      'stories',
      'story-submissions/:submissionId',
      'users',
      'users/:userId',
      'authors',
      'authors/:authorId',
      'author-applications',
      'author-applications/:applicationId',
    ]);

    const guardedPaths = adminChildren.filter((route) => route.path !== '');
    for (const route of guardedPaths) {
      expect(route.canActivate?.length).toBeGreaterThan(0);
    }
  });
});

function shellRoute(): Route {
  const route = routes.find((candidate) => candidate.component === AppShellComponent);

  if (!route) {
    throw new Error('AppShell route is missing');
  }

  return route;
}
