import {
  AuthenticationRequiredException,
  InvalidTokenException,
  TokenExpiredException,
  isAppException,
} from '../exceptions';

interface PassportFailureInfo {
  name?: unknown;
  message?: unknown;
}

function getFailureName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const name = (value as PassportFailureInfo).name;
  return typeof name === 'string' ? name : undefined;
}

export function throwPassportAuthenticationFailure(
  error: unknown,
  info: unknown,
): never {
  if (isAppException(error)) {
    throw error;
  }

  const failure = error ?? info;
  const name = getFailureName(failure);
  if (name === 'TokenExpiredError') {
    throw new TokenExpiredException({
      cause: failure,
    });
  }

  if (name === 'JsonWebTokenError' || name === 'NotBeforeError' || failure) {
    throw new InvalidTokenException({
      message: 'Access token không hợp lệ',
      ...(name ? { details: { reason: name } } : {}),
      cause: failure,
    });
  }

  throw new AuthenticationRequiredException();
}
