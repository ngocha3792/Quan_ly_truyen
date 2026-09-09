import { isIP } from 'node:net';

import type { PaymentProviderConnectionDescriptor } from '../../application';
import {
  InvalidBillingInputException,
  PaymentProviderUnavailableException,
} from '../../domain';

export const VNPAY_ENDPOINTS = {
  SANDBOX: {
    checkout: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    transaction: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  },
  PRODUCTION: {
    checkout: 'https://pay.vnpay.vn/vpcpay.html',
    transaction: 'https://merchant.vnpay.vn/merchant_webapi/api/transaction',
  },
} as const;

export interface VnpayConfig extends Readonly<Record<string, unknown>> {
  readonly environment: keyof typeof VNPAY_ENDPOINTS;
  readonly tmnCode: string;
  readonly returnUrl: string;
  readonly serverIp: string;
  readonly locale: 'vn' | 'en';
}

export function validateVnpayConfig(value: unknown): VnpayConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidBillingInputException(
      'Cấu hình VNPAY không hợp lệ',
      'config',
    );
  }
  const config = value as Record<string, unknown>;
  const allowed = ['environment', 'tmnCode', 'returnUrl', 'serverIp', 'locale'];
  if (Object.keys(config).some((key) => !allowed.includes(key))) {
    throw new InvalidBillingInputException(
      'Cấu hình VNPAY chứa trường không được hỗ trợ',
      'config',
    );
  }
  const environment = config.environment ?? 'SANDBOX';
  if (environment !== 'SANDBOX' && environment !== 'PRODUCTION') {
    throw new InvalidBillingInputException(
      'Môi trường VNPAY không hợp lệ',
      'environment',
    );
  }
  const tmnCode = optionalString(config.tmnCode, 'tmnCode');
  const returnUrl = optionalString(config.returnUrl, 'returnUrl');
  const serverIp = optionalString(config.serverIp, 'serverIp');
  const locale = config.locale ?? 'vn';
  if (tmnCode && !/^[a-zA-Z0-9]{8}$/u.test(tmnCode)) {
    throw new InvalidBillingInputException(
      'TmnCode phải gồm 8 chữ hoặc số',
      'tmnCode',
    );
  }
  if (serverIp && !isIP(serverIp)) {
    throw new InvalidBillingInputException(
      'IP máy chủ không hợp lệ',
      'serverIp',
    );
  }
  if (locale !== 'vn' && locale !== 'en') {
    throw new InvalidBillingInputException(
      'Ngôn ngữ VNPAY không hợp lệ',
      'locale',
    );
  }
  if (returnUrl) {
    let parsed: URL;
    try {
      parsed = new URL(returnUrl);
    } catch {
      throw new InvalidBillingInputException(
        'URL quay lại không hợp lệ',
        'returnUrl',
      );
    }
    const localSandbox =
      environment === 'SANDBOX' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (
      (parsed.protocol !== 'https:' &&
        !(localSandbox && parsed.protocol === 'http:')) ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      returnUrl.length > 200
    ) {
      throw new InvalidBillingInputException(
        'URL quay lại phải dùng HTTPS và không chứa thông tin đăng nhập',
        'returnUrl',
      );
    }
  }
  return { environment, tmnCode, returnUrl, serverIp, locale };
}

export function getVnpayMissingConfiguration(
  config: Readonly<Record<string, unknown>>,
  secrets?: Readonly<Record<string, string>>,
): readonly string[] {
  return [
    ...['tmnCode', 'returnUrl', 'serverIp'].filter((field) => !config[field]),
    ...(!secrets?.hashSecret ? ['hashSecret'] : []),
  ];
}

export function readyVnpayConnection(
  connection: PaymentProviderConnectionDescriptor,
): {
  config: VnpayConfig;
  hashSecret: string;
} {
  const config = validateVnpayConfig(connection.config);
  if (
    connection.kind !== 'VNPAY' ||
    connection.currency !== 'VND' ||
    getVnpayMissingConfiguration(config, connection.secrets).length > 0
  ) {
    throw new PaymentProviderUnavailableException(
      'VNPAY chưa có đủ cấu hình và khóa thanh toán VND',
    );
  }
  const hashSecret = connection.secrets!.hashSecret;
  if (hashSecret.length > 1024 || !hashSecret.trim()) {
    throw new PaymentProviderUnavailableException('Khóa VNPAY không hợp lệ');
  }
  return { config, hashSecret };
}

function optionalString(value: unknown, field: string): string {
  if (value == null || value === '') return '';
  if (typeof value !== 'string')
    throw new InvalidBillingInputException(`${field} không hợp lệ`, field);
  return value.trim();
}
