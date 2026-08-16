import {
  AUDIT_REDACTED_VALUE,
  maskAuditIpAddress,
  sanitizeAuditPayload,
  sanitizeAuditUserAgent,
} from './audit-redaction.policy';

describe('AuditRedactionPolicy', () => {
  it('redacts normalized sensitive keys recursively in objects and arrays', () => {
    const input = {
      passwordHash: 'DO_NOT_LEAK_1',
      nested: {
        refresh_token: 'DO_NOT_LEAK_2',
        sessions: [{ MFA_SECRET: 'DO_NOT_LEAK_3', refreshTokenHash: 'DO_NOT_LEAK_4' }],
      },
    };

    const result = sanitizeAuditPayload(input);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('DO_NOT_LEAK_1');
    expect(serialized).not.toContain('DO_NOT_LEAK_2');
    expect(serialized).not.toContain('DO_NOT_LEAK_3');
    expect(serialized).not.toContain('DO_NOT_LEAK_4');
    expect(serialized.match(/\[REDACTED\]/g)?.length).toBe(4);
  });

  it('redacts credential-shaped values even under a non-sensitive key', () => {
    expect(sanitizeAuditPayload({ header: 'Bearer abc.def.ghi' })).toEqual({
      header: AUDIT_REDACTED_VALUE,
    });
    expect(sanitizeAuditPayload({ tokenish: 'aaaaaaaaaaa.bbbbbbbbbbb.ccccccccccc' })).toEqual({
      tokenish: AUDIT_REDACTED_VALUE,
    });
  });

  it('bounds strings, arrays, objects and deep recursion', () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let index = 0; index < 100; index += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }

    const result = sanitizeAuditPayload({
      long: 'x'.repeat(100_000),
      array: Array.from({ length: 10_000 }, (_, index) => index),
      object: Object.fromEntries(Array.from({ length: 500 }, (_, index) => [`key-${index}`, index])),
      deep,
    });
    const serialized = JSON.stringify(result);
    expect(serialized.length).toBeLessThan(20_000);
    expect(serialized).toContain('[TRUNCATED]');
  });

  it('does not allow stored __proto__ keys to mutate the sanitizer output prototype', () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"safe":"value"}') as unknown;
    const result = sanitizeAuditPayload(input) as Record<string, unknown>;
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(result.safe).toBe('value');
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('masks IP and bounds user agent', () => {
    expect(maskAuditIpAddress('203.0.113.42')).toBe('203.0.113.xxx');
    expect(maskAuditIpAddress('2001:db8:1234:5678:90ab:cdef:1234:5678')).toBe(
      '2001:db8:1234:5678:xxxx:xxxx:xxxx:xxxx',
    );
    expect(sanitizeAuditUserAgent('u'.repeat(2_000))?.length).toBeLessThan(600);
  });
});
