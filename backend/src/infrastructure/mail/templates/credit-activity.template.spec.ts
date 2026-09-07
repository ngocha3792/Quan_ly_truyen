import { creditActivityTemplate } from './credit-activity.template';

describe('creditActivityTemplate', () => {
  it('renders escaped transaction details and a safe action link', () => {
    const result = creditActivityTemplate.render({
      displayName: '<Reader>',
      title: 'Mua chương thành công',
      body: '<25> Credit đã được ghi nhận.',
      amountCredits: '25',
      transactionId: 'tx-123',
      actionUrl: 'https://103.74.100.55.nip.io/tai-khoan/credit',
    });

    expect(result.subject).toBe('Mua chương thành công');
    expect(result.html).toContain('&lt;Reader&gt;');
    expect(result.html).toContain('&lt;25&gt; Credit');
    expect(result.html).toContain(
      'https://103.74.100.55.nip.io/tai-khoan/credit',
    );
    expect(result.text).toContain('tx-123');
  });
});
