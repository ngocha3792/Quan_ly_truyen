import type { AdminAuditLogListItem } from './admin-audit-log.models';

/**
 * Categorical series colors cho donut phân bố đối tượng.
 *
 * Bộ màu và thứ tự này đã qua validator bảng màu ở chế độ dark (surface
 * #0e1526): lightness band, chroma floor, CVD separation, normal-vision floor
 * và contrast đều đạt. Đổi màu hoặc đổi thứ tự thì phải kiểm tra lại.
 */
export const AUDIT_SERIES_COLORS = [
  '#8b5cf6',
  '#0d9488',
  '#d97706',
  '#3b82f6',
  '#ec4899',
  '#16a34a',
] as const;

/** Màu cho nhóm gộp "Khác" — nằm ngoài bộ categorical. */
export const AUDIT_OTHER_COLOR = '#64748b';

const MAX_SERIES = AUDIT_SERIES_COLORS.length;

export interface AuditBarRow {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly share: number;
}

export interface AuditSegment {
  readonly label: string;
  readonly count: number;
  readonly share: number;
  readonly shareLabel: string;
  readonly color: string;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function tally<T>(items: readonly T[], pick: (item: T) => string | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = pick(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function rank(counts: Map<string, number>): readonly (readonly [string, number])[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function distinctActors(items: readonly AdminAuditLogListItem[]): number {
  return tally(items, (item) => item.actorId ?? item.actor?.id ?? null).size;
}

export function distinctActions(items: readonly AdminAuditLogListItem[]): number {
  return tally(items, (item) => item.action).size;
}

export function distinctEntityTypes(items: readonly AdminAuditLogListItem[]): number {
  return tally(items, (item) => item.entityType).size;
}

/** Hành động xuất hiện nhiều nhất, thanh đo theo hành động đứng đầu. */
export function actionRows(
  items: readonly AdminAuditLogListItem[],
  limit = 5,
): readonly AuditBarRow[] {
  const ranked = rank(tally(items, (item) => item.action));
  const top = ranked[0]?.[1] ?? 0;
  return ranked.slice(0, limit).map(([label, count]) => ({
    key: label,
    label,
    count,
    share: top > 0 ? (count / top) * 100 : 0,
  }));
}

/** Phân bố theo loại đối tượng: giữ 6 loại lớn nhất, phần còn lại gộp vào "Khác". */
export function entitySegments(items: readonly AdminAuditLogListItem[]): readonly AuditSegment[] {
  const ranked = rank(tally(items, (item) => item.entityType));
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return [];
  const toShare = (count: number) => (count / total) * 100;
  const segments = ranked.slice(0, MAX_SERIES).map(([label, count], index) => ({
    label,
    count,
    share: toShare(count),
    shareLabel: `${Math.round(toShare(count))}%`,
    color: AUDIT_SERIES_COLORS[index],
  }));
  const rest = ranked.slice(MAX_SERIES).reduce((sum, [, count]) => sum + count, 0);
  if (rest === 0) return segments;
  return [
    ...segments,
    {
      label: 'Khác',
      count: rest,
      share: toShare(rest),
      shareLabel: `${Math.round(toShare(rest))}%`,
      color: AUDIT_OTHER_COLOR,
    },
  ];
}

/**
 * Conic gradient cho donut, chừa khe bằng màu nền giữa các lát để hai lát cạnh
 * nhau vẫn tách bạch khi nhìn bằng mắt lệch màu.
 */
export function donutGradient(segments: readonly AuditSegment[], gapPercent = 0.7): string {
  if (segments.length === 0) return 'conic-gradient(rgba(132, 145, 179, 0.18) 0 100%)';
  if (segments.length === 1) return `conic-gradient(${segments[0].color} 0 100%)`;
  const stops: string[] = [];
  let cursor = 0;
  segments.forEach((segment, index) => {
    const end = index === segments.length - 1 ? 100 : cursor + segment.share;
    const gapStart = Math.max(cursor, end - gapPercent);
    stops.push(`${segment.color} ${cursor}% ${gapStart}%`);
    stops.push(`var(--surface-card-solid) ${gapStart}% ${end}%`);
    cursor = end;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

const CSV_COLUMNS = [
  'createdAt',
  'actorId',
  'actorDisplayName',
  'action',
  'entityType',
  'entityId',
  'requestId',
] as const;

function csvCell(value: string | null): string {
  return `"${(value ?? '').replaceAll('"', '""')}"`;
}

/** CSV của đúng những sự kiện đang hiển thị, không gọi thêm API. */
export function toCsv(items: readonly AdminAuditLogListItem[]): string {
  const rows = items.map((item) =>
    [
      item.createdAt,
      item.actorId,
      item.actor?.displayName ?? null,
      item.action,
      item.entityType,
      item.entityId,
      item.requestId,
    ]
      .map(csvCell)
      .join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n');
}
