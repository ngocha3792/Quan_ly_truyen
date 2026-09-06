export const AI_CREDENTIAL_VAULT_PORT = Symbol.for(
  'modules.ai.credential-vault',
);

export interface AiCredentialVaultPort {
  encrypt(value: string): Promise<string>;
  decrypt(value: string): Promise<string>;
}
