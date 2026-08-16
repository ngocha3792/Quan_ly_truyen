import { Route } from '@angular/router';

import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

describe('application route composition', () => {
  it('keeps standalone routes outside AppShell and the wildcard last', () => {
    expect(routes.map((route) => route.path)).toEqual([
      'author-studio',
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
      'admin/audit-logs',
      'admin/audit-logs/:id',
      'admin/reports',
      'admin/reports/:reportId',
      'admin/categories',
      'admin/tags',
      'admin/stories',
      'admin/story-submissions/:submissionId',
      'admin/users',
      'admin/users/:userId',
      'admin/authors',
      'admin/authors/:authorId',
      'admin/author-applications',
      'admin/author-applications/:applicationId',
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
      'admin/audit-logs',
      'admin/audit-logs/:id',
      'admin/reports',
      'admin/reports/:reportId',
      'admin/categories',
      'admin/tags',
      'admin/stories',
      'admin/story-submissions/:submissionId',
      'admin/users',
      'admin/users/:userId',
      'admin/authors',
      'admin/authors/:authorId',
      'admin/author-applications',
      'admin/author-applications/:applicationId',
    ];

    for (const path of privatePaths) {
      expect(children.find((route) => route.path === path)?.canActivate?.length).toBeGreaterThan(0);
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
