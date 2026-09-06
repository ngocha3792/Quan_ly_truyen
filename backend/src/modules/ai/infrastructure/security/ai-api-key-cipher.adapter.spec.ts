import { AiApiKeyCipherAdapter } from './ai-api-key-cipher.adapter';

describe('AiApiKeyCipherAdapter', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  function createAdapter(encodedKey = key): AiApiKeyCipherAdapter {
    return new AiApiKeyCipherAdapter({
      getOrThrow: jest.fn().mockReturnValue({
        encryptionKeyBase64: encodedKey,
      }),
    } as never);
  }

  it('mã hóa authenticated và giải mã đúng credential', async () => {
    const adapter = createAdapter();
    const envelope = await adapter.encrypt('provider-secret');

    expect(envelope).not.toContain('provider-secret');
    await expect(adapter.decrypt(envelope)).resolves.toBe('provider-secret');
  });

  it('từ chối envelope bị sửa hoặc có phần dư', async () => {
    const adapter = createAdapter();
    const envelope = await adapter.encrypt('provider-secret');
    const parts = envelope.split('.');
    parts[2] = `${parts[2]?.startsWith('a') ? 'b' : 'a'}${parts[2]?.slice(1)}`;

    expect(() => adapter.decrypt(parts.join('.'))).toThrow(
      'Dữ liệu API key không hợp lệ',
    );
    expect(() => adapter.decrypt(`${envelope}.extra`)).toThrow(
      'Dữ liệu API key không hợp lệ',
    );
    expect(() =>
      adapter.decrypt(envelope.replace(/^v1\.([^.]+)/, 'v1.$1!')),
    ).toThrow('Dữ liệu API key không hợp lệ');
  });

  it('fail closed khi encryption key không đủ 32 byte', () => {
    const adapter = createAdapter(Buffer.alloc(16).toString('base64'));

    expect(() => adapter.encrypt('provider-secret')).toThrow(
      'Khóa mã hóa API key AI chưa được cấu hình đúng',
    );
  });
});
