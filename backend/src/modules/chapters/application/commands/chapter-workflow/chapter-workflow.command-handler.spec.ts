import { ChapterWorkflowCommandHandler } from './chapter-workflow.command-handler';

describe('Chapter workflow review input', () => {
  const input = {
    userId: '11111111-1111-4111-8111-111111111111',
    chapterId: '22222222-2222-4222-8222-222222222222',
    expectedVersion: 3,
    audit: {},
  };

  it.each(['REJECTED', 'REQUEST_CHANGES'] as const)(
    'requires a reason for %s',
    (action) => {
      const persistence = { transition: jest.fn() };
      const handler = new ChapterWorkflowCommandHandler(persistence as never);
      expect(() =>
        handler.execute({ ...input, action, comment: '  ' }),
      ).toThrow('Vui lòng ghi rõ lý do');
      expect(persistence.transition).not.toHaveBeenCalled();
    },
  );

  it('forwards the version and trimmed review reason without changing the decision', async () => {
    const persistence = {
      transition: jest.fn().mockResolvedValue({ status: 'DRAFT', version: 4 }),
    };
    const handler = new ChapterWorkflowCommandHandler(persistence as never);
    await handler.execute({
      ...input,
      action: 'REQUEST_CHANGES',
      comment: '  Chỉnh sửa đoạn kết  ',
    });
    expect(persistence.transition).toHaveBeenCalledWith({
      ...input,
      action: 'REQUEST_CHANGES',
      comment: 'Chỉnh sửa đoạn kết',
    });
  });
});
