export const PAYMENT_CREDENTIAL_VAULT_PORT = Symbol(
  'PAYMENT_CREDENTIAL_VAULT_PORT',
);
export interface PaymentCredentialVaultPort {
  available(): boolean;
  seal(code: string, secrets: Readonly<Record<string, string>>): string;
  open(
    code: string,
    envelope?: string | null,
  ): Readonly<Record<string, string>>;
}
