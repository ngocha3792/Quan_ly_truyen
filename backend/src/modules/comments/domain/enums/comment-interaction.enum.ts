export const COMMENT_REACTION_TYPES = [
  'LIKE',
  'LOVE',
  'LAUGH',
  'INSIGHTFUL',
] as const;

export type ReactionName = (typeof COMMENT_REACTION_TYPES)[number];

export const COMMENT_REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'HATE_SPEECH',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'COPYRIGHT',
  'MISINFORMATION',
  'OTHER',
] as const;

export type ReportReasonName = (typeof COMMENT_REPORT_REASONS)[number];
