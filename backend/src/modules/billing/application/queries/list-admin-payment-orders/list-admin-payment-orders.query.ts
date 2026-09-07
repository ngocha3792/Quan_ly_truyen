import type { PaymentOrderStatusName } from '../../../domain';

export class ListAdminPaymentOrdersQuery {
  constructor(
    public readonly page: number,
    public readonly pageSize: number,
    public readonly status?: PaymentOrderStatusName,
    public readonly provider?: string,
    public readonly search?: string,
    public readonly from?: string,
    public readonly to?: string,
  ) {}
}
