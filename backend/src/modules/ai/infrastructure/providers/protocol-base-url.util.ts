export function normalizeProtocolBaseUrl(
  url: URL,
  defaultVersionPath: 'v1' | 'v1beta',
): string {
  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = `/${defaultVersionPath}`;
  }

  return url.toString().replace(/\/+$/, '');
}
