import type { AuthPasswordPolicyConfig } from '../config/app-config.token';

export interface PasswordPolicyEvaluation {
  readonly minimumLength: boolean;
  readonly maximumLength: boolean;
  readonly maximumBytes: boolean;
  readonly lowercase: boolean;
  readonly uppercase: boolean;
  readonly number: boolean;
  readonly symbol: boolean;
  readonly valid: boolean;
}

export function evaluatePasswordPolicy(
  value: string,
  policy: AuthPasswordPolicyConfig,
): PasswordPolicyEvaluation {
  const evaluation = {
    minimumLength: value.length >= policy.minimumLength,
    maximumLength: value.length <= policy.maximumLength,
    maximumBytes: new TextEncoder().encode(value).length <= policy.maximumBytes,
    lowercase: !policy.requireLowercase || /[a-z]/.test(value),
    uppercase: !policy.requireUppercase || /[A-Z]/.test(value),
    number: !policy.requireNumber || /\d/.test(value),
    symbol: !policy.requireSymbol || /[^A-Za-z0-9]/.test(value),
  };

  return {
    ...evaluation,
    valid: Object.values(evaluation).every(Boolean),
  };
}

export function passwordPolicyHint(policy: AuthPasswordPolicyConfig): string {
  const requirements: string[] = [];
  if (policy.requireLowercase) requirements.push('chữ thường');
  if (policy.requireUppercase) requirements.push('chữ hoa');
  if (policy.requireNumber) requirements.push('chữ số');
  if (policy.requireSymbol) requirements.push('ký tự đặc biệt');

  const suffix = requirements.length > 0 ? `, có ${requirements.join(', ')}` : '';
  return `Từ ${policy.minimumLength} đến ${policy.maximumLength} ký tự, tối đa ${policy.maximumBytes} byte UTF-8${suffix}.`;
}
