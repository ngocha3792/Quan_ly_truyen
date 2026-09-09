import { CommentsController } from './comments.controller';

describe('CommentsController report input', () => {
  const execute = jest.fn();
  const controller = new CommentsController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { execute } as never,
  );

  beforeEach(() => execute.mockReset());

  it('does not forward legacy client-supplied anchor evidence to the command', async () => {
    await controller.createReport('reporter', '127.0.0.1', 'comment', {
      reason: 'SPAM',
      description: 'Please review this comment',
      anchorBlockId: 'forged',
      anchorQuote: 'forged quote',
      chapterVersion: 999,
    });
    expect(execute).toHaveBeenCalledWith({
      input: {
        userId: 'reporter',
        commentId: 'comment',
        reason: 'SPAM',
        description: 'Please review this comment',
        ipAddress: '127.0.0.1',
      },
    });
  });

  it('requires an authenticated reporter before executing any command', () => {
    expect(() =>
      controller.createReport(undefined, undefined, 'comment', {
        reason: 'SPAM',
      }),
    ).toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
