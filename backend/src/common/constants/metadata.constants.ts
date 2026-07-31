/**
 * Keys written by decorators and read by guards/interceptors through Reflector.
 * Namespacing prevents collisions with metadata from third-party libraries.
 */
export const ROUTE_METADATA = {
  PUBLIC: 'quan-ly-truyen:route:public',
  ROLES: 'quan-ly-truyen:route:roles',
  PERMISSIONS: 'quan-ly-truyen:route:permissions',

  SKIP_RESPONSE_ENVELOPE: 'quan-ly-truyen:route:skip-response-envelope',
  SKIP_REQUEST_LOGGING: 'quan-ly-truyen:route:skip-request-logging',
  SKIP_REQUEST_TIMEOUT: 'quan-ly-truyen:route:skip-request-timeout',
  REQUEST_TIMEOUT_MS: 'quan-ly-truyen:route:request-timeout-ms',

  IDEMPOTENT: 'quan-ly-truyen:route:idempotent',
  CACHE_TTL_SECONDS: 'quan-ly-truyen:route:cache-ttl-seconds',
} as const;

// Named exports keep decorator and guard imports concise.
export const IS_PUBLIC_KEY = ROUTE_METADATA.PUBLIC;
export const ROLES_KEY = ROUTE_METADATA.ROLES;
export const PERMISSIONS_KEY = ROUTE_METADATA.PERMISSIONS;
export const SKIP_RESPONSE_ENVELOPE_KEY = ROUTE_METADATA.SKIP_RESPONSE_ENVELOPE;
export const SKIP_REQUEST_LOGGING_KEY = ROUTE_METADATA.SKIP_REQUEST_LOGGING;
export const SKIP_REQUEST_TIMEOUT_KEY = ROUTE_METADATA.SKIP_REQUEST_TIMEOUT;
export const REQUEST_TIMEOUT_MS_KEY = ROUTE_METADATA.REQUEST_TIMEOUT_MS;
export const IDEMPOTENT_KEY = ROUTE_METADATA.IDEMPOTENT;
export const CACHE_TTL_SECONDS_KEY = ROUTE_METADATA.CACHE_TTL_SECONDS;
