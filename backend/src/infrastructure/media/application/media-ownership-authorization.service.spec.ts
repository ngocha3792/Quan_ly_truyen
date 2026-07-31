import { PermissionCode } from '@/common/enums';
import { MediaOwnershipAuthorizationService } from './media-ownership-authorization.service';

describe('MediaOwnershipAuthorizationService delete authorization', () => {
  const service = new MediaOwnershipAuthorizationService({} as never);
  const principal = {
    userId: '00000000-0000-4000-8000-000000000001',
    sessionId: '00000000-0000-4000-8000-000000000002',
    emailVerified: true,
    roles: [],
    permissions: [],
  };

  it('allows the uploader', () => {
    expect(() =>
      service.assertCanDelete(principal, principal.userId),
    ).not.toThrow();
  });

  it('allows media.manage.any explicitly', () => {
    expect(() =>
      service.assertCanDelete(
        { ...principal, permissions: [PermissionCode.MEDIA_MANAGE_ANY] },
        '00000000-0000-4000-8000-000000000003',
      ),
    ).not.toThrow();
  });

  it('does not grant an implicit role-based bypass', () => {
    expect(() =>
      service.assertCanDelete(
        { ...principal, roles: ['ADMIN'] as never },
        '00000000-0000-4000-8000-000000000003',
      ),
    ).toThrow();
  });
});
