import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PWA static artifacts', () => {
  const publicRoot = resolve(process.cwd(), 'public');

  it('ships valid manifest icons and a neutral install manifest', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(publicRoot, 'manifest.webmanifest'), 'utf8'),
    ) as {
      readonly start_url: string;
      readonly shortcuts?: unknown;
      readonly icons: readonly { readonly src: string }[];
    };

    expect(manifest.start_url).toBe('/');
    expect(manifest.shortcuts).toBeUndefined();
    for (const icon of manifest.icons) {
      expect(existsSync(resolve(publicRoot, icon.src.replace(/^\//, '')))).toBe(true);
    }
  });

  it('uses index.html first for navigation fallback and scopes private caches by client', () => {
    const worker = readFileSync(resolve(publicRoot, 'sw.js'), 'utf8');

    expect(worker).toContain("shell.match('/index.html')");
    expect(worker).toContain('privateCachesByClient.get(clientId)');
    expect(worker).not.toContain('activePrivateCacheName');
    expect(worker).toContain('Authentication and API responses always remain network-only.');
  });
});
