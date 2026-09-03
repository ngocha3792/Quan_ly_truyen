interface RoutedRequest {
  method?: unknown;
  baseUrl?: unknown;
  originalUrl?: unknown;
  url?: unknown;
  route?: { path?: unknown };
}

export function resolveHttpRouteTemplate(request: RoutedRequest): string {
  const routePath = readRoutePath(request.route?.path);
  if (!routePath) return 'unmatched';
  const baseUrl = typeof request.baseUrl === 'string' ? request.baseUrl : '';
  const combined = `${baseUrl}/${routePath}`
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '');
  return combined.startsWith('/') ? combined || '/' : `/${combined}`;
}

export function shouldSkipHttpObservability(request: RoutedRequest): boolean {
  const path = stripQuery(
    typeof request.originalUrl === 'string'
      ? request.originalUrl
      : typeof request.url === 'string'
        ? request.url
        : '',
  );
  return (
    path === '/internal/metrics' ||
    path === API_PATHS.HEALTH_LIVE ||
    path === API_PATHS.HEALTH_READY
  );
}

function readRoutePath(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    const first = value.find(
      (entry): entry is string => typeof entry === 'string' && Boolean(entry),
    );
    return first;
  }
  return undefined;
}

function stripQuery(value: string): string {
  return value.split('?', 1)[0] ?? '';
}
import { API_PATHS } from '@/common/constants';
