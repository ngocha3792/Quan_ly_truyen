import { ConfigService } from '@nestjs/config';
import { CloudinarySignatureAdapter } from './cloudinary-signature.adapter';

describe('CloudinarySignatureAdapter comic eager transformations', () => {
  it('signs and returns eager AVIF, WebP and JPEG parameters for chapter images', () => {
    const sign = jest.fn().mockReturnValue('signature');
    const adapter = new CloudinarySignatureAdapter(
      { utils: { api_sign_request: sign } } as never,
      new ConfigService({
        cloudinary: {
          cloudName: 'cloud',
          apiKey: 'key',
          apiSecret: 'secret',
          eagerNotificationUrl:
            'https://example.test/api/v1/webhooks/cloudinary',
          uploadPresets: { chapterImage: 'chapter-images' },
        },
      }),
    );
    const result = adapter.createSignedUpload({
      mediaAssetId: 'asset-id',
      purpose: 'CHAPTER_IMAGE',
      publicId: 'page',
      assetFolder: 'chapters',
      resourceType: 'image',
      confirmExpiresAt: new Date(0),
    });
    expect(result.parameters.eager).toContain('f_avif');
    expect(result.parameters.eager).toContain('f_webp');
    expect(result.parameters.eager).toContain('f_jpg');
    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({ eager_async: true }),
      'secret',
    );
  });
});
