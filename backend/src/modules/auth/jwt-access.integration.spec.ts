import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';

import { CurrentUser, Public } from '@/common/decorators/auth';
import { JwtTokenType } from '@/common/enums';
import { JwtAuthGuard } from '@/common/guards';
import { CommonFiltersModule } from '@/common/filters';
import type {
  AccessTokenPayload,
  AuthPrincipal,
} from '@/common/interfaces/auth';
import { AccessTokenValidationService } from './services/access-token-validation.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

const secret = 'integration-access-secret-at-least-32-characters';
const userId = '00000000-0000-4000-8000-000000000001';
const sessionId = '00000000-0000-4000-8000-000000000002';

@Controller('auth-test')
class AuthTestController {
  @Get('protected')
  protectedRoute(@CurrentUser() principal: AuthPrincipal) {
    return { userId: principal.userId };
  }

  @Get('public')
  @Public()
  publicRoute() {
    return { public: true };
  }
}

describe('JWT access guard integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const validation = {
      validate: jest.fn().mockImplementation((payload: AccessTokenPayload) => ({
        userId: payload.sub,
        sessionId: payload.sid,
        emailVerified: true,
        roles: [],
        permissions: [],
      })),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ session: false }),
        CommonFiltersModule,
      ],
      controllers: [AuthTestController],
      providers: [
        JwtAccessStrategy,
        JwtAuthGuard,
        { provide: APP_GUARD, useExisting: JwtAuthGuard },
        { provide: AccessTokenValidationService, useValue: validation },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            auth: {
              accessTokenSecret: secret,
              issuer: 'integration-issuer',
              audience: 'integration-audience',
            },
          }),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  const httpServer = () => app.getHttpServer() as Parameters<typeof request>[0];

  const sign = (options: jwt.SignOptions = {}) =>
    jwt.sign(
      { sub: userId, sid: sessionId, typ: JwtTokenType.ACCESS, ver: 0 },
      secret,
      {
        algorithm: 'HS256',
        issuer: 'integration-issuer',
        audience: 'integration-audience',
        expiresIn: '5m',
        ...options,
      },
    );

  it('returns 401 without a token', async () => {
    await request(httpServer()).get('/auth-test/protected').expect(401);
  });

  it('places the validated principal on request.user', async () => {
    await request(httpServer())
      .get('/auth-test/protected')
      .set('Authorization', `Bearer ${sign()}`)
      .expect(200)
      .expect({ userId });
  });

  it('rejects expired and bad-signature tokens', async () => {
    await request(httpServer())
      .get('/auth-test/protected')
      .set('Authorization', `Bearer ${sign({ expiresIn: -1 })}`)
      .expect(401);
    const badSignature = jwt.sign(
      { sub: userId, sid: sessionId, typ: JwtTokenType.ACCESS, ver: 0 },
      'different-secret-at-least-32-characters',
      {
        issuer: 'integration-issuer',
        audience: 'integration-audience',
        expiresIn: '5m',
      },
    );
    await request(httpServer())
      .get('/auth-test/protected')
      .set('Authorization', `Bearer ${badSignature}`)
      .expect(401);
  });

  it('keeps @Public routes accessible', async () => {
    await request(httpServer())
      .get('/auth-test/public')
      .expect(200)
      .expect({ public: true });
  });
});
