/**
 * Stable application-wide values.
 *
 * Environment-dependent values such as port, database URL, JWT secret,
 * issuer, public URL and deployment timezone must live in ConfigService.
 */
export const APP_NAME = 'quan-ly-truyen';

export const API_GLOBAL_PREFIX = 'api';
export const API_VERSION = 'v1';
export const API_PREFIX = `${API_GLOBAL_PREFIX}/${API_VERSION}`;

export const DEFAULT_LOCALE = 'vi-VN';
export const UTC_TIME_ZONE = 'UTC';
export const UTF8_ENCODING = 'utf-8';
