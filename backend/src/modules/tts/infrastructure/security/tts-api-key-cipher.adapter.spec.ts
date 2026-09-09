import { ConfigService } from '@nestjs/config';

import { TtsApiKeyCipherAdapter } from './tts-api-key-cipher.adapter';

describe('TtsApiKeyCipherAdapter', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('round-trips a credential without exposing plaintext', async () => {
    const vault = createVault(key);
    const envelope = await vault.encrypt('secret-api-key');
    expect(envelope).not.toContain('secret-api-key');
    await expect(vault.decrypt(envelope)).resolves.toBe('secret-api-key');
  });

  it('rejects tampered envelopes', async () => {
    const vault = createVault(key);
    const envelope = await vault.encrypt('secret-api-key');
    const parts = envelope.split('.');
    const ciphertext = parts[2] ?? '';
    parts[2] = `${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;
    expect(() => vault.decrypt(parts.join('.'))).toThrow(
      'Dữ liệu API key TTS không hợp lệ',
    );
  });
});

function createVault(encryptionKeyBase64: string): TtsApiKeyCipherAdapter {
  return new TtsApiKeyCipherAdapter({
    getOrThrow: jest.fn().mockReturnValue({ encryptionKeyBase64 }),
  } as unknown as ConfigService);
}
