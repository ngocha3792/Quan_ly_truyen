import { PermissionCode } from '@/common/enums';

import type { AuthPrincipal } from '@/common/interfaces/auth';

import {
  AuthorApplicationStatus,
  MediaPurpose,
} from '@/generated/prisma/client';

import { PrismaMediaOwnershipAdapter } from './prisma-media-ownership.adapter';

describe('PrismaMediaOwnershipAdapter', () => {
  const principal: AuthPrincipal = {
    userId: '00000000-0000-4000-8000-000000000001',

    sessionId: '00000000-0000-4000-8000-000000000002',

    emailVerified: true,

    roles: [],

    permissions: [],
  };

  const ownerId = '00000000-0000-4000-8000-000000000003';

  describe('AUTHOR_APPLICATION_SAMPLE', () => {
    it('cho phép owner upload sample khi application còn DRAFT/REJECTED', async () => {
      const prisma = {
        authorApplication: {
          findFirst: jest.fn().mockResolvedValue({
            id: ownerId,
          }),
        },
      };

      const service = new PrismaMediaOwnershipAdapter(prisma as never);

      await expect(
        service.assertCanCreate(
          principal,

          MediaPurpose.AUTHOR_APPLICATION_SAMPLE,

          ownerId,
        ),
      ).resolves.toBeUndefined();

      expect(prisma.authorApplication.findFirst).toHaveBeenCalledWith({
        where: {
          id: ownerId,

          userId: principal.userId,

          status: {
            in: [
              AuthorApplicationStatus.DRAFT,

              AuthorApplicationStatus.REJECTED,
            ],
          },
        },

        select: {
          id: true,
        },
      });
    });

    it('từ chối nếu không tìm thấy application thuộc owner trong trạng thái cho phép', async () => {
      const prisma = {
        authorApplication: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      const service = new PrismaMediaOwnershipAdapter(prisma as never);

      await expect(
        service.assertCanCreate(
          principal,

          MediaPurpose.AUTHOR_APPLICATION_SAMPLE,

          ownerId,
        ),
      ).rejects.toThrow('Không có quyền quản lý media');
    });

    it('generic ATTACHMENT không còn coi AuthorApplication là owner hợp lệ', async () => {
      const prisma = {
        story: {
          findFirst: jest.fn().mockResolvedValue(null),
        },

        chapter: {
          findFirst: jest.fn().mockResolvedValue(null),
        },

        authorApplication: {
          findFirst: jest.fn(),
        },
      };

      const service = new PrismaMediaOwnershipAdapter(prisma as never);

      await expect(
        service.assertCanCreate(
          principal,

          MediaPurpose.ATTACHMENT,

          ownerId,
        ),
      ).rejects.toThrow();

      /*
       * Stage 1 đã tách sample purpose.
       * Generic attachment không được
       * query AuthorApplication nữa.
       */
      expect(prisma.authorApplication.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('delete authorization', () => {
    const service = new PrismaMediaOwnershipAdapter({} as never);

    it('allows the uploader', () => {
      expect(() =>
        service.assertCanDelete(
          principal,

          principal.userId,
        ),
      ).not.toThrow();
    });

    it('allows media.manage.any explicitly', () => {
      expect(() =>
        service.assertCanDelete(
          {
            ...principal,

            permissions: [PermissionCode.MEDIA_MANAGE_ANY],
          },

          ownerId,
        ),
      ).not.toThrow();
    });

    it('does not grant an implicit role-based bypass', () => {
      expect(() =>
        service.assertCanDelete(
          {
            ...principal,

            roles: ['ADMIN'] as never,
          },

          ownerId,
        ),
      ).toThrow();
    });
  });
});
