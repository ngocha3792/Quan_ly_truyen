import { ConfigService } from '@nestjs/config';
import { LeakTokenService } from './leak-token.service';

describe('LeakTokenService', () => {
  it('creates pseudonymous, tamper-evident tokens without raw user IDs', () => {
    const service = new LeakTokenService({
      getOrThrow: () => 'root-secret',
    } as unknown as ConfigService);
    const token = service.generate({
      userId: '11111111-1111-4111-8111-111111111111',
      assetId: 'asset',
      chapterId: 'chapter',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    expect(token).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(service.decode(token)).toMatchObject({
      assetId: 'asset',
      chapterId: 'chapter',
    });
    expect(service.decode(`${token.slice(0, -1)}A`)).toBeNull();
  });
});
