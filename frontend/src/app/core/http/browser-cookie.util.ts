export function readBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }

  const matches = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );

  return matches ? decodeURIComponent(matches[1]) : null;
}
