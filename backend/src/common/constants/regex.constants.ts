/**
 * Generic lexical patterns only. Prefer class-validator for DTO validation.
 */
export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
