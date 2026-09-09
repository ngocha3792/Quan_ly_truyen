import { ChapterWorkflowPolicy } from './chapter-workflow.policy';

describe('Chapter workflow policy', () => {
  it('requires an approved chapter before scheduling or publishing', () => {
    for (const status of [
      'DRAFT',
      'IN_REVIEW',
      'PUBLISHED',
      'ARCHIVED',
      'HIDDEN',
    ]) {
      expect(ChapterWorkflowPolicy.canPublish(status)).toBe(false);
    }
    expect(ChapterWorkflowPolicy.canPublish('APPROVED')).toBe(true);
    expect(ChapterWorkflowPolicy.canPublish('SCHEDULED')).toBe(true);
  });

  it('only reopens approved chapters and sends both negative decisions back to draft', () => {
    expect(ChapterWorkflowPolicy.nextStatus('APPROVED', 'reopen')).toBe(
      'DRAFT',
    );
    expect(ChapterWorkflowPolicy.nextStatus('SCHEDULED', 'reopen')).toBeNull();
    expect(
      ChapterWorkflowPolicy.nextStatus('IN_REVIEW', 'REQUEST_CHANGES'),
    ).toBe('DRAFT');
    expect(ChapterWorkflowPolicy.nextStatus('IN_REVIEW', 'REJECTED')).toBe(
      'DRAFT',
    );
    expect(ChapterWorkflowPolicy.nextStatus('DRAFT', 'submit')).toBe(
      'IN_REVIEW',
    );
  });
});
