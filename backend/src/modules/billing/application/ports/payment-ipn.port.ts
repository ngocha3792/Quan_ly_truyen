export const PAYMENT_IPN_PORT = Symbol('PAYMENT_IPN_PORT');
export interface PaymentIpnPort {
  handle(
    code: string,
    query: Readonly<Record<string, string>>,
  ): Promise<{ RspCode: string; Message: string }>;
}
