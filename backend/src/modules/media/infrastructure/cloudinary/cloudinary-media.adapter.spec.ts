import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { InvalidInputException } from '@/common/exceptions';
import { CloudinaryMediaAdapter } from './cloudinary-media.adapter';
import type { ConfirmUploadInput } from '../../application/ports/media-storage.port';

const API_SECRET = 'test-secret';

function sign(publicId: string, version: number): string {
  return createHash('sha1')
    .update(`public_id=${publicId}&version=${version}${API_SECRET}`)
    .digest('hex');
}

describe('CloudinaryMediaAdapter', () => {
  const authoritativeAsset = {
    asset_id: 'provider-id',
    public_id: 'asset-id',
    version: 42,
    resource_type: 'image',
    type: 'upload',
    secure_url: 'https://res.cloudinary.com/test/image/upload/asset-id.png',
    bytes: 12,
  };
  const client = {
    utils: { api_sign_request: jest.fn().mockReturnValue('sdk-computed') },
    api: { resource: jest.fn().mockResolvedValue(authoritativeAsset) },
  };
  const configService = new ConfigService({
    cloudinary: { apiSecret: API_SECRET },
  });
  const adapter = new CloudinaryMediaAdapter(
    client as never,
    configService,
    {} as never,
    {} as never,
    { recordMediaUpload: jest.fn() } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  function confirmInput(
    overrides: Partial<ConfirmUploadInput> = {},
  ): ConfirmUploadInput {
    return {
      publicId: 'asset-id',
      version: 42,
      responseSignature: sign('asset-id', 42),
      resourceType: 'image',
      ...overrides,
    };
  }

  it('accepts a genuinely SHA-1-signed Cloudinary upload response', async () => {
    await expect(adapter.confirmUpload(confirmInput())).resolves.toMatchObject({
      publicId: 'asset-id',
    });
  });

  it('does not rely on the SDK signature_algorithm-dependent helper', async () => {
    await adapter.confirmUpload(confirmInput());
    expect(client.utils.api_sign_request).not.toHaveBeenCalled();
  });

  it('rejects a signature computed with the wrong algorithm (e.g. SHA-256)', async () => {
    const wrongSignature = createHash('sha256')
      .update(`public_id=asset-id&version=42${API_SECRET}`)
      .digest('hex');
    await expect(
      adapter.confirmUpload(
        confirmInput({ responseSignature: wrongSignature }),
      ),
    ).rejects.toThrow(InvalidInputException);
    expect(client.api.resource).not.toHaveBeenCalled();
  });

  it('rejects a signature for a mismatched version', async () => {
    await expect(
      adapter.confirmUpload(confirmInput({ version: 43 })),
    ).rejects.toThrow(InvalidInputException);
  });
});
