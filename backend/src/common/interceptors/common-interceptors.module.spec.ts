import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { COMMON_HTTP_TIMEOUT_MS } from '@/common/constants';

import { CommonInterceptorsModule } from './common-interceptors.module';

describe('CommonInterceptorsModule', () => {
  it('binds the global timeout to app.requestTimeoutMs', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ app: { requestTimeoutMs: 43_210 } })],
        }),
        CommonInterceptorsModule,
      ],
    }).compile();

    expect(moduleRef.get<number>(COMMON_HTTP_TIMEOUT_MS)).toBe(43_210);

    await moduleRef.close();
  });
});
