import { AiUsageSummary } from './admin-ai-settings.models';

/**
 * Categorical series colors for the token-distribution donut.
 *
 * Thứ tự này đã được kiểm tra bằng validator của skill dataviz ở chế độ dark
 * (surface #0e1526): lightness band, chroma floor, CVD separation, normal-vision
 * floor và contrast đều PASS. Đổi thứ tự hoặc thay màu thì phải chạy lại.
 */
export const AI_SERIES_COLORS = [
  '#8b5cf6',
  '#0d9488',
  '#d97706',
  '#3b82f6',
  '#ec4899',
  '#16a34a',
] as const;

/** Màu cho nhóm gộp "Khác" — nằm ngoài bộ categorical. */
export const AI_SERIES_OTHER_COLOR = '#64748b';

const MAX_SERIES = AI_SERIES_COLORS.length;

export interface AiBarRow {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly display: string;
  readonly share: number;
}

export interface AiTokenSegment {
  readonly label: string;
  readonly tokens: number;
  readonly share: number;
  readonly shareLabel: string;
  readonly color: string;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function share(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

/** Mức sử dụng theo model, đo bằng tỷ trọng requests. */
export function modelRequestRows(usage: AiUsageSummary): readonly AiBarRow[] {
  const total = usage.byModel.reduce((sum, item) => sum + item.requests, 0);
  return [...usage.byModel]
    .sort((a, b) => b.requests - a.requests)
    .map((item) => ({
      key: `${item.protocol ?? 'none'}:${item.model}`,
      label: item.model,
      hint: item.protocol ?? 'Không rõ protocol',
      display: formatPercent(share(item.requests, total)),
      share: share(item.requests, total),
    }));
}

/** Độ trễ trung bình theo model, thanh đo theo model chậm nhất. */
export function modelLatencyRows(usage: AiUsageSummary): readonly AiBarRow[] {
  const slowest = usage.byModel.reduce((max, item) => Math.max(max, item.averageLatencyMs), 0);
  return [...usage.byModel]
    .sort((a, b) => b.averageLatencyMs - a.averageLatencyMs)
    .map((item) => ({
      key: `${item.protocol ?? 'none'}:${item.model}`,
      label: item.model,
      hint: `${formatCount(item.requests)} yêu cầu`,
      display: `${formatCount(item.averageLatencyMs)} ms`,
      share: share(item.averageLatencyMs, slowest),
    }));
}

/** Tỷ trọng requests theo kết nối. */
export function connectionRows(usage: AiUsageSummary): readonly AiBarRow[] {
  const total = usage.byConnection.reduce((sum, item) => sum + item.requests, 0);
  return [...usage.byConnection]
    .sort((a, b) => b.requests - a.requests)
    .map((item) => ({
      key: `${item.connectionId ?? 'none'}:${item.protocol ?? 'none'}`,
      label: item.connectionName,
      hint: `${formatCount(item.averageLatencyMs)} ms · lỗi ${formatPercent(item.errorRate)}`,
      display: `${formatCount(item.requests)} yêu cầu`,
      share: share(item.requests, total),
    }));
}

/** Phân bổ token theo model: giữ 6 model lớn nhất, phần còn lại gộp vào "Khác". */
export function tokenSegments(usage: AiUsageSummary): readonly AiTokenSegment[] {
  const total = usage.byModel.reduce((sum, item) => sum + item.totalTokens, 0);
  if (total <= 0) return [];
  const sorted = [...usage.byModel].sort((a, b) => b.totalTokens - a.totalTokens);
  const segments = sorted.slice(0, MAX_SERIES).map((item, index) => ({
    label: item.model,
    tokens: item.totalTokens,
    share: share(item.totalTokens, total),
    shareLabel: formatPercent(share(item.totalTokens, total)),
    color: AI_SERIES_COLORS[index],
  }));
  const rest = sorted.slice(MAX_SERIES).reduce((sum, item) => sum + item.totalTokens, 0);
  if (rest <= 0) return segments;
  return [
    ...segments,
    {
      label: 'Khác',
      tokens: rest,
      share: share(rest, total),
      shareLabel: formatPercent(share(rest, total)),
      color: AI_SERIES_OTHER_COLOR,
    },
  ];
}

/**
 * Conic gradient cho donut, chừa khe bằng màu nền giữa các lát để hai lát cạnh
 * nhau không dính vào nhau khi nhìn bằng mắt lệch màu.
 */
export function donutGradient(segments: readonly AiTokenSegment[], gapPercent = 0.7): string {
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

export function tokensPerRequest(usage: AiUsageSummary): number {
  const { requests, totalTokens } = usage.totals;
  return requests > 0 ? totalTokens / requests : 0;
}

export function successRate(usage: AiUsageSummary): number {
  const { requests, successfulRequests } = usage.totals;
  return requests > 0 ? share(successfulRequests, requests) : 0;
}
