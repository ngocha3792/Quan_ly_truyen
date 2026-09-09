import type { PaymentProviderConnectionRecord } from '../../ports';
import { InvalidBillingInputException } from '../../../domain';
import { API_PREFIX } from '@/common/constants';

export const VNPAY_ADMIN_FIELDS = [
  {
    name: 'environment',
    label: 'Môi trường',
    required: true,
    type: 'select',
    defaultValue: 'SANDBOX',
    options: [
      { value: 'SANDBOX', label: 'Sandbox' },
      { value: 'PRODUCTION', label: 'Production' },
    ],
  },
  {
    name: 'tmnCode',
    label: 'Mã website (TmnCode)',
    required: true,
    type: 'text',
  },
  {
    name: 'returnUrl',
    label: 'URL quay lại website',
    required: true,
    type: 'url',
  },
  {
    name: 'serverIp',
    label: 'IP máy chủ gửi đối soát/hoàn tiền',
    required: true,
    type: 'text',
  },
  {
    name: 'locale',
    label: 'Ngôn ngữ',
    required: false,
    type: 'select',
    defaultValue: 'vn',
    options: [
      { value: 'vn', label: 'Tiếng Việt' },
      { value: 'en', label: 'English' },
    ],
  },
  {
    name: 'hashSecret',
    label: 'Khóa ký (HashSecret)',
    required: true,
    type: 'password',
    secret: true,
  },
] as const;

export function suppliedCredentials(input?: Readonly<Record<string, string>>) {
  if (!input) return undefined;
  if (Object.keys(input).some((key) => key !== 'hashSecret'))
    throw new InvalidBillingInputException(
      'Trường khóa không được hỗ trợ',
      'credentials',
    );
  if (input.hashSecret === undefined || input.hashSecret === '')
    return undefined;
  if (
    typeof input.hashSecret !== 'string' ||
    !input.hashSecret.trim() ||
    input.hashSecret.length > 1024
  )
    throw new InvalidBillingInputException(
      'Khóa ký không hợp lệ',
      'hashSecret',
    );
  return { hashSecret: input.hashSecret.trim() };
}
export function publicProviderConfiguration(
  record: PaymentProviderConnectionRecord,
  storageAvailable: boolean,
  publicUrl: string,
) {
  const { encryptedCredential, ...safe } = record;
  const secretConfiguredFields = encryptedCredential ? ['hashSecret'] : [];
  const missingConfigurationFields =
    record.kind === 'VNPAY'
      ? [
          ...['tmnCode', 'returnUrl', 'serverIp'].filter(
            (field) => !record.config[field],
          ),
          ...(!encryptedCredential ? ['hashSecret'] : []),
          ...(!storageAvailable ? ['credentialsStorage'] : []),
        ]
      : [];
  return {
    ...safe,
    secretConfiguredFields,
    missingConfigurationFields,
    configurationReady: missingConfigurationFields.length === 0,
    credentialsStorageAvailable: storageAvailable,
    webhookUrl:
      record.kind === 'VNPAY'
        ? `${publicUrl.replace(/\/$/u, '')}/${API_PREFIX}/webhooks/payments/${record.code}/ipn`
        : null,
    returnUrl:
      record.kind === 'VNPAY'
        ? typeof record.config.returnUrl === 'string' && record.config.returnUrl
          ? record.config.returnUrl
          : `${publicUrl.replace(/\/$/u, '')}/tai-khoan/credit/ket-qua-thanh-toan`
        : null,
  };
}
