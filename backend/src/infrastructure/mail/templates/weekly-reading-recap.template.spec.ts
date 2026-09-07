import { weeklyReadingRecapTemplate } from './weekly-reading-recap.template';

describe('weeklyReadingRecapTemplate', () => {
  it('renders only recorded weekly values and includes the opt-out explanation', () => {
    const result = weeklyReadingRecapTemplate.render({
      displayName: '<Reader>',
      weekStart: '2026-08-31',
      weekEnd: '2026-09-06',
      readingMinutes: 90,
      chaptersCompleted: 3,
      activeDays: 4,
      recapUrl: 'https://103.74.100.55.nip.io/tai-khoan/lich-su',
    });

    expect(result.subject).toContain('2026-08-31 - 2026-09-06');
    expect(result.text).toContain('1 giờ 30 phút');
    expect(result.html).toContain('&lt;Reader&gt;');
    expect(result.html).toContain('đã chủ động bật');
    expect(result.tags).toEqual(['notification', 'weekly-reading-recap']);
  });
});
