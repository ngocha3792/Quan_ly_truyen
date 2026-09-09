export type ChapterWorkflowAction =
  'submit' | 'reopen' | 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES';

export class ChapterWorkflowPolicy {
  static nextStatus(
    status: string,
    action: ChapterWorkflowAction,
  ): string | null {
    if (action === 'submit') return status === 'DRAFT' ? 'IN_REVIEW' : null;
    if (action === 'reopen') return status === 'APPROVED' ? 'DRAFT' : null;
    if (status !== 'IN_REVIEW') return null;
    return action === 'APPROVED' ? 'APPROVED' : 'DRAFT';
  }

  static canPublish(status: string): boolean {
    return status === 'APPROVED' || status === 'SCHEDULED';
  }
}
