export const COMMON_MIDDLEWARE_OPTIONS = Symbol.for(
  'quan-ly-truyen.common.middleware-options',
);

export const DEFAULT_SUPPORTED_LOCALES = [
  'vi-VN',
  'en-US',
] as const;

export const DEFAULT_MAINTENANCE_ALLOWED_PATHS = [
  '/health',
  '/api/health',
  '/api/v1/health',
] as const;

export const JSON_MUTATION_METHODS = [
  'POST',
  'PUT',
  'PATCH',
] as const;

export const SAFE_EXTERNAL_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
