export interface RequestContextMiddlewareOptions {
  trustIncomingRequestId?: boolean;
  trustIncomingCorrelationId?: boolean;
  maxExternalIdLength?: number;
}

export interface LocaleMiddlewareOptions {
  defaultLocale?: string;
  supportedLocales?: readonly string[];
}

export interface MaintenanceModeState {
  enabled: boolean;
  message?: string;
  retryAfterSeconds?: number;
}

export interface MaintenanceModeMiddlewareOptions {
  resolveState?: () => MaintenanceModeState | Promise<MaintenanceModeState>;
  allowedPaths?: readonly string[];
  bypassHeaderName?: string;
  bypassToken?: string;
}

export interface JsonContentTypeMiddlewareOptions {
  methods?: readonly string[];
  allowVendorJson?: boolean;
}

export interface CommonMiddlewaresOptions {
  requestContext?: RequestContextMiddlewareOptions;
  locale?: LocaleMiddlewareOptions;
  maintenance?: MaintenanceModeMiddlewareOptions;
  jsonContentType?: JsonContentTypeMiddlewareOptions;
}
