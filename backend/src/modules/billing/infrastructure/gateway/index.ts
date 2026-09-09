import { BillingGatewayManager } from '../../application/commands/gateway-operations/billing-gateway.manager';
import { BILLING_GATEWAY_PERSISTENCE_PORT } from '../../application/ports/billing-gateway.persistence.port';
import { PrismaBillingGatewayPersistence } from './prisma-billing-gateway.persistence';
import { BillingGatewayReader } from './billing-gateway-reader';

export { PrismaBillingGatewayPersistence } from './prisma-billing-gateway.persistence';
export const BILLING_GATEWAY_PROVIDERS = [
  BillingGatewayManager,
  PrismaBillingGatewayPersistence,
  BillingGatewayReader,
  {
    provide: BILLING_GATEWAY_PERSISTENCE_PORT,
    useExisting: PrismaBillingGatewayPersistence,
  },
];
