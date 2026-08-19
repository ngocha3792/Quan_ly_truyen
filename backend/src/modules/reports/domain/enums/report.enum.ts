export const REPORT_STATUS_VALUES = [
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'REJECTED',
] as const;

export type ReportStatusName = (typeof REPORT_STATUS_VALUES)[number];

export const REPORT_REASON_VALUES = [
  'SPAM',
  'HARASSMENT',
  'HATE_SPEECH',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'COPYRIGHT',
  'MISINFORMATION',
  'OTHER',
] as const;

export type ReportReasonName = (typeof REPORT_REASON_VALUES)[number];
