import { AUTHOR_APPLICATION_SAMPLE_FILE_POLICY } from '@/common/policies/author-application-sample-file.policy';

import { MediaPurpose } from '@/generated/prisma/client';

import { MEDIA_UPLOAD_POLICIES } from './media-upload-policy.registry';

describe('MEDIA_UPLOAD_POLICIES', () => {
  it('author application sample phải dùng đúng shared backend policy', () => {
    const policy =
      MEDIA_UPLOAD_POLICIES[MediaPurpose.AUTHOR_APPLICATION_SAMPLE];

    expect(policy.resourceType).toBe('raw');

    expect(policy.allowedFormats).toEqual(
      AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.allowedFormats,
    );

    expect(policy.allowedMimeTypes).toEqual(
      AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.allowedMimeTypes,
    );

    expect(policy.mimeFormatPairs).toEqual(
      AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.mimeFormatPairs,
    );

    expect(policy.maxBytes).toBe(
      AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.maxBytes,
    );
  });

  it('author application sample tuyệt đối không cho phép zip', () => {
    const policy =
      MEDIA_UPLOAD_POLICIES[MediaPurpose.AUTHOR_APPLICATION_SAMPLE];

    expect(policy.allowedFormats).not.toContain('zip');

    expect(policy.allowedMimeTypes).not.toContain('application/zip');
  });

  it('generic attachment vẫn có thể cho phép zip độc lập', () => {
    const policy = MEDIA_UPLOAD_POLICIES[MediaPurpose.ATTACHMENT];

    expect(policy.allowedFormats).toContain('zip');

    expect(policy.allowedMimeTypes).toContain('application/zip');
  });
});
