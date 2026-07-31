import * as jwt from 'jsonwebtoken';

import {
  InvalidTokenException,
  TokenExpiredException,
} from '../exceptions';

export interface CommonJwtClaims extends jwt.JwtPayload {
  sub: string;
  sid?: string;
  typ?: string;
  ver?: number;
}

export interface JwtSignConfig {
  key: jwt.Secret | jwt.PrivateKey;
  algorithm: jwt.Algorithm;
  expiresIn: NonNullable<jwt.SignOptions['expiresIn']>;
  issuer: string;
  audience: string | [string, ...string[]];
  subject?: string;
  jwtId?: string;
  keyId?: string;
}

export interface JwtVerifyConfig {
  key: jwt.Secret | jwt.PublicKey;
  algorithms: [jwt.Algorithm, ...jwt.Algorithm[]];
  issuer: string | [string, ...string[]];
  audience:
    | string
    | RegExp
    | [string | RegExp, ...(string | RegExp)[]];
  subject?: string;
  clockToleranceSeconds?: number;
  maxAge?: jwt.VerifyOptions['maxAge'];
}

export interface DecodedJwt<TClaims extends jwt.JwtPayload> {
  header: jwt.JwtHeader;
  payload: TClaims;
  signature: string;
}

function assignDefined<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

export function signJwt<TPayload extends object>(
  payload: TPayload,
  config: JwtSignConfig,
): string {
  if (config.algorithm === 'none') {
    throw new TypeError('Thuật toán JWT "none" không được phép');
  }

  const options: jwt.SignOptions = {
    algorithm: config.algorithm,
    expiresIn: config.expiresIn,
    issuer: config.issuer,
    audience: Array.isArray(config.audience)
      ? [...config.audience]
      : config.audience,
    mutatePayload: false,
  };

  assignDefined(options, 'subject', config.subject);
  assignDefined(options, 'jwtid', config.jwtId);
  assignDefined(options, 'keyid', config.keyId);

  return jwt.sign(payload, config.key, options);
}

export function verifyJwt<TClaims extends jwt.JwtPayload>(
  token: string,
  config: JwtVerifyConfig,
): TClaims {
  if (!token || typeof token !== 'string') {
    throw new InvalidTokenException({
      message: 'Token không được để trống',
    });
  }

  if (config.algorithms.length === 0 || config.algorithms.includes('none')) {
    throw new TypeError('Phải khai báo ít nhất một thuật toán JWT an toàn');
  }

  const options: jwt.VerifyOptions = {
    algorithms: [...config.algorithms],
    issuer: Array.isArray(config.issuer)
      ? [...config.issuer] as [string, ...string[]]
      : config.issuer,
    audience:
      typeof config.audience === 'string' ||
      config.audience instanceof RegExp
        ? config.audience
        : [...config.audience] as [
            string | RegExp,
            ...(string | RegExp)[],
          ],
    complete: false,
  };

  assignDefined(options, 'subject', config.subject);
  assignDefined(
    options,
    'clockTolerance',
    config.clockToleranceSeconds,
  );
  assignDefined(options, 'maxAge', config.maxAge);

  try {
    const decoded = jwt.verify(token, config.key, options);

    if (typeof decoded === 'string') {
      throw new InvalidTokenException({
        message: 'JWT payload phải là một object',
      });
    }

    return decoded as TClaims;
  } catch (error: unknown) {
    if (error instanceof TokenExpiredException) {
      throw error;
    }

    if (error instanceof InvalidTokenException) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredException({
        details: {
          expiredAt: error.expiredAt.toISOString(),
        },
        cause: error,
      });
    }

    if (error instanceof jwt.NotBeforeError) {
      throw new InvalidTokenException({
        code: 'TOKEN_NOT_ACTIVE',
        message: 'Token chưa có hiệu lực',
        details: {
          activeAt: error.date.toISOString(),
        },
        cause: error,
      });
    }

    throw new InvalidTokenException({
      cause: error,
    });
  }
}

/**
 * Chỉ decode, không xác minh chữ ký. Không dùng kết quả này để cấp quyền.
 */
export function decodeJwtUnsafe<TClaims extends jwt.JwtPayload>(
  token: string,
): DecodedJwt<TClaims> | null {
  const decoded = jwt.decode(token, {
    complete: true,
    json: true,
  });

  if (!decoded || typeof decoded.payload === 'string') {
    return null;
  }

  return {
    header: decoded.header,
    payload: decoded.payload as TClaims,
    signature: decoded.signature,
  };
}

export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

export function getJwtExpirationDate(token: string): Date | null {
  const decoded = decodeJwtUnsafe<jwt.JwtPayload>(token);
  const exp = decoded?.payload.exp;

  return typeof exp === 'number' ? new Date(exp * 1_000) : null;
}

export function isJwtExpired(
  token: string,
  now: Date = new Date(),
  clockToleranceSeconds = 0,
): boolean {
  const expirationDate = getJwtExpirationDate(token);

  if (!expirationDate) {
    return true;
  }

  return (
    expirationDate.getTime() + clockToleranceSeconds * 1_000 <=
    now.getTime()
  );
}
