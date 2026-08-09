import { GUARDS_METADATA } from '@nestjs/common/constants';

import { VerifiedEmailGuard } from '@/common/guards';

import { AuthorApplicationsController } from './author-applications.controller';

describe('AuthorApplicationsController verified-email policy', () => {
  it('bắt buộc verified email ở các mutation của applicant', () => {
    expect(guardsOf('saveMyDraft')).toContain(VerifiedEmailGuard);

    expect(guardsOf('submitMyApplication')).toContain(VerifiedEmailGuard);
  });

  it('không khóa các read endpoint bằng verified-email guard', () => {
    expect(guardsOf('getConfiguration')).not.toContain(VerifiedEmailGuard);

    expect(guardsOf('getMyApplication')).not.toContain(VerifiedEmailGuard);
  });
});

function guardsOf(
  this: void,
  methodName:
    | 'getConfiguration'
    | 'getMyApplication'
    | 'saveMyDraft'
    | 'submitMyApplication',
): readonly unknown[] {
  const guards = Reflect.getMetadata(
    GUARDS_METADATA,
    AuthorApplicationsController.prototype,
    methodName,
  ) as readonly unknown[] | undefined;

  return guards ?? [];
}
