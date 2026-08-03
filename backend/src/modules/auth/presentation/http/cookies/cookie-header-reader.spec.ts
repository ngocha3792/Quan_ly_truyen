import { readCookieFromHeader } from './cookie-header-reader';

describe('readCookieFromHeader', () => {
  it('returns missing when Cookie header is absent', () => {
    expect(
      readCookieFromHeader(
        undefined,

        'refresh_token',
      ),
    ).toEqual({
      status: 'missing',
    });
  });

  it('returns missing when the requested cookie does not exist', () => {
    expect(
      readCookieFromHeader(
        'theme=dark; csrf_token=csrf-value',

        'refresh_token',
      ),
    ).toEqual({
      status: 'missing',
    });
  });

  it('reads exactly one valid cookie', () => {
    expect(
      readCookieFromHeader(
        'theme=dark; refresh_token=refresh-value; csrf_token=csrf-value',

        'refresh_token',
      ),
    ).toEqual({
      status: 'valid',

      value: 'refresh-value',
    });
  });

  it('decodes a percent-encoded cookie value', () => {
    expect(
      readCookieFromHeader(
        'refresh_token=token%2Epart%2Evalue',

        'refresh_token',
      ),
    ).toEqual({
      status: 'valid',

      value: 'token.part.value',
    });
  });

  it('does not confuse cookie names with the same prefix', () => {
    expect(
      readCookieFromHeader(
        ['refresh_token_backup=backup-value', 'refresh_token=real-value'].join(
          '; ',
        ),

        'refresh_token',
      ),
    ).toEqual({
      status: 'valid',

      value: 'real-value',
    });
  });

  it('rejects duplicate cookies', () => {
    expect(
      readCookieFromHeader(
        'refresh_token=first; refresh_token=second',

        'refresh_token',
      ),
    ).toEqual({
      status: 'duplicate',
    });
  });

  it('rejects a valid cookie followed by a malformed duplicate', () => {
    expect(
      readCookieFromHeader(
        'refresh_token=first; refresh_token',

        'refresh_token',
      ),
    ).toEqual({
      status: 'duplicate',
    });
  });

  it('rejects an empty cookie value', () => {
    expect(
      readCookieFromHeader(
        'refresh_token=',

        'refresh_token',
      ),
    ).toEqual({
      status: 'malformed',
    });
  });

  it('rejects a cookie without an equals sign', () => {
    expect(
      readCookieFromHeader(
        'theme=dark; refresh_token; csrf_token=value',

        'refresh_token',
      ),
    ).toEqual({
      status: 'malformed',
    });
  });

  it('rejects invalid percent encoding', () => {
    expect(
      readCookieFromHeader(
        'refresh_token=%E0%A4%A',

        'refresh_token',
      ),
    ).toEqual({
      status: 'malformed',
    });
  });

  it('ignores malformed unrelated cookies', () => {
    expect(
      readCookieFromHeader(
        'broken-cookie; refresh_token=valid-value',

        'refresh_token',
      ),
    ).toEqual({
      status: 'valid',

      value: 'valid-value',
    });
  });
});
