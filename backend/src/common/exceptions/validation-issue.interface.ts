export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
  rejectedValue?: unknown;
}
