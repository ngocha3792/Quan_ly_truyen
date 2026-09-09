export const TTS_CREDENTIAL_VAULT_PORT = Symbol.for(
  'quan-ly-truyen.modules.tts.credential-vault',
);

export interface TtsCredentialVaultPort {
  encrypt(value: string): Promise<string>;
  decrypt(value: string): Promise<string>;
}
