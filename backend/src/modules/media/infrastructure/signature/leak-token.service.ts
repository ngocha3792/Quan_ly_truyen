import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LeakTokenService {
  private readonly secret: string;
  constructor(config: ConfigService) {
    this.secret =
      process.env.LEAK_TOKEN_SECRET ??
      config.getOrThrow<string>('auth.accessTokenSecret');
  }
  generate(input: {
    userId: string;
    assetId: string;
    chapterId: string;
    expiresAt: Date;
  }): string {
    const data = JSON.stringify({
      u: this.hash(input.userId),
      a: input.assetId,
      c: input.chapterId,
      e: Math.floor(input.expiresAt.getTime() / 1000),
    });
    return Buffer.from(
      `${data}.${createHmac('sha256', this.secret).update(data).digest('hex').slice(0, 24)}`,
    ).toString('base64url');
  }
  decode(token: string): {
    userHash: string;
    assetId: string;
    chapterId: string;
    expiresAt: Date;
  } | null {
    try {
      const raw = Buffer.from(token, 'base64url').toString('utf8');
      const split = raw.lastIndexOf('.');
      if (split < 1) return null;
      const data = raw.slice(0, split);
      const sig = raw.slice(split + 1);
      const expected = createHmac('sha256', this.secret)
        .update(data)
        .digest('hex')
        .slice(0, 24);
      if (
        sig.length !== expected.length ||
        !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      )
        return null;
      const value = JSON.parse(data) as {
        u?: string;
        a?: string;
        c?: string;
        e?: number;
      };
      if (!value.u || !value.a || !value.c || !Number.isSafeInteger(value.e))
        return null;
      const expiresAtSeconds = value.e as number;
      return {
        userHash: value.u,
        assetId: value.a,
        chapterId: value.c,
        expiresAt: new Date(expiresAtSeconds * 1000),
      };
    } catch {
      return null;
    }
  }
  private hash(value: string): string {
    return createHmac('sha256', this.secret)
      .update(value)
      .digest('hex')
      .slice(0, 32);
  }
}
