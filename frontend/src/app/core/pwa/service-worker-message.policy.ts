export function isAllowedManifestAssetUrl(
  value: unknown,
  appOrigin: string,
  apiBaseUrl: string,
): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) return false;

  let parsed: URL;
  try {
    parsed = new URL(value, appOrigin);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.origin !== appOrigin) return parsed.protocol === 'https:';

  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return false;
  }
  const apiPath = new URL(apiBaseUrl, appOrigin).pathname.replace(/\/$/, '');
  return pathname !== apiPath && !pathname.startsWith(`${apiPath}/`);
}

export function chunkManifestAssets<T>(
  assets: readonly T[],
  chunkSize = 250,
): readonly (readonly T[])[] {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new Error('Service Worker asset chunk size không hợp lệ.');
  }
  const chunks: T[][] = [];
  for (let index = 0; index < assets.length; index += chunkSize) {
    chunks.push(assets.slice(index, index + chunkSize));
  }
  return chunks;
}
