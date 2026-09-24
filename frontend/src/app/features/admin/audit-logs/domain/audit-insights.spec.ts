import type { AdminAuditLogListItem } from './admin-audit-log.models';
import {
  AUDIT_OTHER_COLOR,
  AUDIT_SERIES_COLORS,
  actionRows,
  distinctActions,
  distinctActors,
  distinctEntityTypes,
  donutGradient,
  entitySegments,
  toCsv,
} from './audit-insights';

function item(
  overrides: Partial<AdminAuditLogListItem> & Pick<AdminAuditLogListItem, 'id'>,
): AdminAuditLogListItem {
  return {
    actorId: 'u1',
    actor: { id: 'u1', displayName: 'Người A' },
    action: 'chapter_published',
    entityType: 'chapter',
    entityId: 'e1',
    requestId: 'r1',
    createdAt: '2026-09-24T07:00:00.000Z',
    ...overrides,
  };
}

describe('audit insights', () => {
  const items = [
    item({ id: '1' }),
    item({ id: '2' }),
    item({ id: '3', action: 'user_updated', entityType: 'user', actorId: 'u2', actor: null }),
  ];

  it('counts distinct actors, actions and entity types', () => {
    expect(distinctActors(items)).toBe(2);
    expect(distinctActions(items)).toBe(2);
    expect(distinctEntityTypes(items)).toBe(2);
  });

  it('ignores events with no actor when counting actors', () => {
    expect(distinctActors([item({ id: '1', actorId: null, actor: null })])).toBe(0);
  });

  it('ranks actions by frequency and scales bars against the top action', () => {
    expect(actionRows(items)).toEqual([
      { key: 'chapter_published', label: 'chapter_published', count: 2, share: 100 },
      { key: 'user_updated', label: 'user_updated', count: 1, share: 50 },
    ]);
  });

  it('assigns series colors in fixed order and folds the tail into "Khác"', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      item({ id: `m${index}`, entityType: `type-${index}` }),
    );
    const segments = entitySegments(many);
    expect(segments).toHaveLength(AUDIT_SERIES_COLORS.length + 1);
    expect(segments.map((segment) => segment.color)).toEqual([
      ...AUDIT_SERIES_COLORS,
      AUDIT_OTHER_COLOR,
    ]);
    expect(segments.at(-1)).toMatchObject({ label: 'Khác', count: 2 });
  });

  it('keeps every entity type when they fit inside the series palette', () => {
    expect(entitySegments(items).map((segment) => [segment.label, segment.shareLabel])).toEqual([
      ['chapter', '67%'],
      ['user', '33%'],
    ]);
  });

  it('leaves a surface gap between adjacent donut slices', () => {
    const gradient = donutGradient(entitySegments(items));
    expect(gradient.startsWith('conic-gradient(')).toBe(true);
    expect(gradient).toContain('var(--surface-card-solid)');
    expect(gradient).toContain('100%)');
  });

  it('falls back to a neutral ring when there is nothing to show', () => {
    expect(entitySegments([])).toEqual([]);
    expect(donutGradient([])).toContain('conic-gradient');
  });

  it('escapes quotes so a display name cannot break the CSV', () => {
    const csv = toCsv([
      item({ id: '1', actor: { id: 'u1', displayName: 'Người "A"' }, requestId: null }),
    ]);
    const [header, row] = csv.split('\n');
    expect(header).toBe('createdAt,actorId,actorDisplayName,action,entityType,entityId,requestId');
    expect(row).toContain('"Người ""A"""');
    expect(row.endsWith('""')).toBe(true);
  });
});
