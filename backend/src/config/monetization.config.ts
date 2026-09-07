import { registerAs } from '@nestjs/config';

import type { MonetizationConfig } from './config.types';

export const MONETIZATION_CONFIG_KEY = 'monetization';

export default registerAs(MONETIZATION_CONFIG_KEY, (): MonetizationConfig => ({
  enabled: process.env.MONETIZATION_ENABLED === 'true',
  authorPricingEnabled: process.env.AUTHOR_PRICING_ENABLED === 'true',
  paymentProviderEnabled: process.env.PAYMENT_PROVIDER_ENABLED === 'true',
  paywallEnforcementEnabled: process.env.PAYWALL_ENFORCEMENT_ENABLED === 'true',
}));
