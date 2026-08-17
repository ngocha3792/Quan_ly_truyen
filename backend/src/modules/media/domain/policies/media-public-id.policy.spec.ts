import { MediaPurpose } from '@/generated/prisma/client';
import { MEDIA_UPLOAD_POLICIES } from './media-upload-policy.registry';
import { MediaPublicIdPolicy } from './media-public-id.policy';

describe('MediaPublicIdPolicy', () => {
  const service = new MediaPublicIdPolicy();
  const image = MEDIA_UPLOAD_POLICIES[MediaPurpose.AVATAR];
  const raw = MEDIA_UPLOAD_POLICIES[MediaPurpose.ATTACHMENT];

  it('keeps image public ID extensionless', () =>
    expect(service.build('asset-id', 'avatar.WEBP', image)).toBe('asset-id'));
  it('adds a lowercase validated extension to raw public IDs', () =>
    expect(service.build('asset-id', 'manual.PDF', raw)).toBe('asset-id.pdf'));
  it.each([
    'manual',
    'manual.exe',
    '../manual.pdf',
    'folder/manual.pdf',
    'manual..pdf',
    'manual.pdf\0.exe',
  ])('rejects unsafe or unsupported filename %s', (name) =>
    expect(() => service.build('asset-id', name, raw)).toThrow(),
  );
});
