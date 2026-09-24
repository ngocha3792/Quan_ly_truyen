import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

import { PERMISSIONS_KEY } from '@/common/constants';
import { PermissionCode } from '@/common/enums';

import { AdminContentTakedownController } from './admin-content-takedown.controller';

/* eslint-disable @typescript-eslint/unbound-method */
const ROUTES = {
  chapter: AdminContentTakedownController.prototype.chapter,
  story: AdminContentTakedownController.prototype.story,
};
/* eslint-enable @typescript-eslint/unbound-method */

describe('AdminContentTakedownController', () => {
  it('nằm dưới tiền tố admin riêng, không đụng vào route nào đang có UI', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, AdminContentTakedownController),
    ).toBe('admin/content-takedown');
  });

  it.each([
    ['chapter', ROUTES.chapter, 'chapters/:chapterId'],
    ['story', ROUTES.story, 'stories/:storyId'],
  ])('map %s vào một route DELETE', (_label, handler, path) => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.DELETE,
    );
  });

  // "Ngầm" chỉ là không hiện ra giao diện: endpoint vẫn phải qua permission
  // guard, nên đây là phần dễ mất nhất khi ai đó sửa controller sau này.
  it('bắt buộc quyền quản lý chương cộng quyền kiểm duyệt để gỡ chương', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ROUTES.chapter)).toEqual([
      PermissionCode.CHAPTER_MANAGE_ANY,
      PermissionCode.MODERATION_EXECUTE,
    ]);
  });

  it('bắt buộc quyền xóa truyện bất kỳ cộng quyền kiểm duyệt để gỡ truyện', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ROUTES.story)).toEqual([
      PermissionCode.STORY_DELETE_ANY,
      PermissionCode.MODERATION_EXECUTE,
    ]);
  });
});
