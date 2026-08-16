import { diffSanitizedAuditValues } from './audit-diff.policy';
import { sanitizeAuditPayload } from './audit-redaction.policy';

describe('AuditDiffPolicy', () => {
  it('reports added, removed, changed and nested changes', () => {
    const before = sanitizeAuditPayload({
      status: 'ACTIVE',
      profile: { name: 'A' },
      removed: true,
    });
    const after = sanitizeAuditPayload({
      status: 'SUSPENDED',
      profile: { name: 'B' },
      added: 1,
    });
    expect(diffSanitizedAuditValues(before, after)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'status',
          type: 'changed',
          before: 'ACTIVE',
          after: 'SUSPENDED',
        }),
        expect.objectContaining({ path: 'profile.name', type: 'changed' }),
        expect.objectContaining({ path: 'removed', type: 'removed' }),
        expect.objectContaining({ path: 'added', type: 'added' }),
      ]),
    );
  });

  it('treats arrays atomically and suppresses equal redacted secrets', () => {
    const before = sanitizeAuditPayload({
      roles: ['USER'],
      passwordHash: 'secret-1',
    });
    const after = sanitizeAuditPayload({
      roles: ['USER', 'AUTHOR'],
      passwordHash: 'secret-2',
    });
    const changes = diffSanitizedAuditValues(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ path: 'roles', type: 'changed' });
  });
});
