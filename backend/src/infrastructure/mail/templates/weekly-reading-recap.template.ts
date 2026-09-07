import type { MailTemplate } from '../contracts';
import {
  emailLayout,
  escapeHtml,
  requiredNumber,
  requiredString,
  safeLink,
} from './shared';
import { MailTemplateId } from './mail-template-id.enum';

export const weeklyReadingRecapTemplate: MailTemplate = {
  id: MailTemplateId.WEEKLY_READING_RECAP,
  render(variables) {
    const displayName = escapeHtml(requiredString(variables, 'displayName'));
    const weekStart = escapeHtml(requiredString(variables, 'weekStart'));
    const weekEnd = escapeHtml(requiredString(variables, 'weekEnd'));
    const readingMinutes = Math.max(
      0,
      Math.round(requiredNumber(variables, 'readingMinutes')),
    );
    const chaptersCompleted = Math.max(
      0,
      Math.round(requiredNumber(variables, 'chaptersCompleted')),
    );
    const activeDays = Math.max(
      0,
      Math.round(requiredNumber(variables, 'activeDays')),
    );
    const recapUrl = safeLink(variables.recapUrl, 'recapUrl');
    const subject = `Tổng kết đọc tuần ${weekStart} - ${weekEnd}`;
    const body = `<p>Chào <strong>${displayName}</strong>, đây là số liệu đọc được ghi nhận trong tuần của bạn.</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0"><tr><td style="padding:12px;border:1px solid #e5e7eb"><strong>${formatMinutes(readingMinutes)}</strong><br><span class="muted">Thời gian đọc</span></td><td style="padding:12px;border:1px solid #e5e7eb"><strong>${chaptersCompleted}</strong><br><span class="muted">Chương hoàn thành</span></td><td style="padding:12px;border:1px solid #e5e7eb"><strong>${activeDays}/7</strong><br><span class="muted">Ngày có hoạt động</span></td></tr></table><p><a class="button" href="${recapUrl}">Xem lịch sử đọc</a></p><p class="muted">Bạn nhận email này vì đã chủ động bật Tổng kết đọc tuần. Có thể tắt bất cứ lúc nào trong Thiết lập thông báo.</p>`;

    return {
      subject,
      text: `Chào ${requiredString(variables, 'displayName')}. Tuần ${requiredString(variables, 'weekStart')} - ${requiredString(variables, 'weekEnd')}: ${formatMinutes(readingMinutes)}, ${chaptersCompleted} chương hoàn thành, ${activeDays}/7 ngày có hoạt động. ${String(variables.recapUrl)}`,
      html: emailLayout(subject, body),
      tags: ['notification', 'weekly-reading-recap'],
    };
  },
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours} giờ` : `${hours} giờ ${remaining} phút`;
}
