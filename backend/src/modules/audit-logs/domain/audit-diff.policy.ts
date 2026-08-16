import type { SafeAuditValue } from './audit-redaction.policy';
import { AUDIT_REDACTED_VALUE } from './audit-redaction.policy';

export type AuditChangeType = 'added' | 'removed' | 'changed';

export interface AuditChange {
  readonly path: string;
  readonly type: AuditChangeType;
  readonly before: SafeAuditValue | null;
  readonly after: SafeAuditValue | null;
}

const isRecord = (value: SafeAuditValue): value is { readonly [key: string]: SafeAuditValue } =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function equivalent(left: SafeAuditValue | undefined, right: SafeAuditValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function bothRedacted(left: SafeAuditValue | undefined, right: SafeAuditValue | undefined): boolean {
  return left === AUDIT_REDACTED_VALUE && right === AUDIT_REDACTED_VALUE;
}

export function diffSanitizedAuditValues(
  before: SafeAuditValue,
  after: SafeAuditValue,
  maxEntries = 200,
): readonly AuditChange[] {
  const changes: AuditChange[] = [];

  const visit = (
    left: SafeAuditValue | undefined,
    right: SafeAuditValue | undefined,
    path: string,
  ): void => {
    if (changes.length >= maxEntries || equivalent(left, right) || bothRedacted(left, right)) return;

    if (left === undefined) {
      changes.push({ path, type: 'added', before: null, after: right ?? null });
      return;
    }
    if (right === undefined) {
      changes.push({ path, type: 'removed', before: left, after: null });
      return;
    }

    if (isRecord(left) && isRecord(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      for (const key of keys) {
        if (changes.length >= maxEntries) break;
        visit(left[key], right[key], path ? `${path}.${key}` : key);
      }
      return;
    }

    changes.push({ path: path || '$', type: 'changed', before: left, after: right });
  };

  visit(before, after, '');
  return changes;
}
