import { chunkManifestAssets, isAllowedManifestAssetUrl } from './service-worker-message.policy';

describe('Service Worker manifest asset policy', () => {
  const origin = 'https://truyenhub.example';
  const api = '/api/v1';

  it('allows explicit static/CDN assets but never API or unsafe URLs', () => {
    expect(isAllowedManifestAssetUrl('/chunk-ABC.js', origin, api)).toBe(true);
    expect(isAllowedManifestAssetUrl('https://cdn.example.com/page.webp', origin, api)).toBe(true);
    expect(isAllowedManifestAssetUrl('/api/v1/offline-packages/p1/manifest', origin, api)).toBe(
      false,
    );
    expect(isAllowedManifestAssetUrl('/api%2Fv1/private', origin, api)).toBe(false);
    expect(isAllowedManifestAssetUrl('http://cdn.example.com/page.webp', origin, api)).toBe(false);
    expect(isAllowedManifestAssetUrl('data:text/plain,secret', origin, api)).toBe(false);
  });

  it('chunks manifests below the worker message boundary', () => {
    const chunks = chunkManifestAssets(
      Array.from({ length: 2_001 }, (_, index) => `${index}`),
      250,
    );
    expect(chunks).toHaveLength(9);
    expect(chunks.every((chunk) => chunk.length <= 250)).toBe(true);
    expect(chunks.flat()).toHaveLength(2_001);
  });
});
