import { AuthorApplicationStatus } from '../../domain';

import type { AuthorApplicationRecord } from '../ports';

export const APPLICATION_ID =
  '11111111-1111-4111-8111-111111111111';

export const OWNER_ID =
  '22222222-2222-4222-8222-222222222222';

export const REVIEWER_ID =
  '33333333-3333-4333-8333-333333333333';

export const SAMPLE_MEDIA_ID =
  '44444444-4444-4444-8444-444444444444';

export function createAuthorApplication(  status: AuthorApplicationStatus = AuthorApplicationStatus.PENDING,): AuthorApplicationRecord {  const now =    new Date('2026-08-09T00:00:00.000Z');  return {    id: APPLICATION_ID,    userId: OWNER_ID,    status,    penName: 'Coverage Author',    fullName: 'Coverage Applicant',    email: 'coverage@example.test',    phone: '0900000000',    portfolioUrl: 'https://example.test/portfolio',    primaryGenre: 'tien-hiep',    experience: '1-3-years',    introduction:      'Tôi muốn trở thành tác giả trên nền tảng.',    firstWorkSynopsis:      'Nội dung tóm tắt tác phẩm đầu tiên.',    acceptedTerms: true,    sample: null,    submittedAt:      status === AuthorApplicationStatus.DRAFT        ? null        : now,    reviewedAt:      status === AuthorApplicationStatus.APPROVED ||      status === AuthorApplicationStatus.REJECTED        ? now        : null,    reviewedById:      status === AuthorApplicationStatus.APPROVED ||      status === AuthorApplicationStatus.REJECTED        ? REVIEWER_ID        : null,    rejectionReason:      status === AuthorApplicationStatus.REJECTED        ? 'Hồ sơ cần bổ sung thêm nội dung.'        : null,    createdAt: now,    updatedAt: now,  };}