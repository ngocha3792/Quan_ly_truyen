import { AUTHOR_APPLICATION_SAMPLE_FILE_POLICY } from '@/common/policies/author-application-sample-file.policy';

export interface AuthorApplicationOption {
  readonly value: string;

  readonly label: string;
}

export interface AuthorApplicationRequirement {
  readonly id: string;

  readonly content: string;
}

export interface AuthorApplicationReviewStep {
  readonly number: number;

  readonly title: string;

  readonly description: string;
}

export interface AuthorApplicationBenefit {
  readonly id: string;

  readonly icon: 'work' | 'analytics' | 'community';

  readonly title: string;

  readonly description: string;
}

export class AuthorApplicationPolicy {
  static readonly PEN_NAME_MAX_LENGTH = 40;

  static readonly FULL_NAME_MAX_LENGTH = 80;

  static readonly INTRODUCTION_MAX_LENGTH = 500;

  static readonly SYNOPSIS_MAX_LENGTH = 1000;

  static readonly REJECTION_REASON_MAX_LENGTH = 1000;

  static readonly SAMPLE_MAXIMUM_FILE_SIZE_MB =
    AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.maximumFileSizeMb;

  static readonly SAMPLE_FILE_EXTENSIONS =
    AUTHOR_APPLICATION_SAMPLE_FILE_POLICY.allowedExtensions;

  static readonly GENRES: readonly AuthorApplicationOption[] = [
    {
      value: 'tien-hiep',

      label: 'Tiên hiệp',
    },

    {
      value: 'huyen-huyen',

      label: 'Huyền huyễn',
    },

    {
      value: 'do-thi',

      label: 'Đô thị',
    },

    {
      value: 'ngon-tinh',

      label: 'Ngôn tình',
    },

    {
      value: 'kiem-hiep',

      label: 'Kiếm hiệp',
    },

    {
      value: 'khoa-huyen',

      label: 'Khoa huyễn',
    },

    {
      value: 'kinh-di',

      label: 'Kinh dị',
    },

    {
      value: 'lich-su',

      label: 'Lịch sử',
    },

    {
      value: 'khac',

      label: 'Thể loại khác',
    },
  ];

  static readonly EXPERIENCES: readonly AuthorApplicationOption[] = [
    {
      value: 'new',

      label: 'Chưa từng sáng tác',
    },

    {
      value: 'under-1-year',

      label: 'Dưới 1 năm',
    },

    {
      value: '1-3-years',

      label: 'Từ 1 đến 3 năm',
    },

    {
      value: '3-5-years',

      label: 'Từ 3 đến 5 năm',
    },

    {
      value: 'over-5-years',

      label: 'Trên 5 năm',
    },
  ];

  static readonly REQUIREMENTS: readonly AuthorApplicationRequirement[] = [
    {
      id: 'requirement-information',

      content: 'Cung cấp đầy đủ và chính xác thông tin cá nhân.',
    },

    {
      id: 'requirement-sample',

      content: 'Có mẫu nội dung hoặc chương truyện rõ ràng.',
    },

    {
      id: 'requirement-community',

      content: 'Cam kết tuân thủ quy định nội dung và chính sách cộng đồng.',
    },
  ];

  static readonly REVIEW_STEPS: readonly AuthorApplicationReviewStep[] = [
    {
      number: 1,

      title: 'Gửi yêu cầu',

      description: 'Hoàn thành biểu mẫu và gửi hồ sơ đăng ký.',
    },

    {
      number: 2,

      title: 'Đội ngũ xét duyệt',

      description: 'Hồ sơ được đội ngũ quản trị kiểm tra.',
    },

    {
      number: 3,

      title: 'Kích hoạt hồ sơ tác giả',

      description: 'Khi được duyệt, tài khoản nhận quyền tác giả.',
    },
  ];

  static readonly BENEFITS: readonly AuthorApplicationBenefit[] = [
    {
      id: 'benefit-work',

      icon: 'work',

      title: 'Quản lý tác phẩm',

      description: 'Dễ đăng tải, chỉnh sửa và sắp xếp tác phẩm.',
    },

    {
      id: 'benefit-analytics',

      icon: 'analytics',

      title: 'Thống kê lượt đọc',

      description: 'Theo dõi số liệu chi tiết và hiệu quả nội dung.',
    },

    {
      id: 'benefit-community',

      icon: 'community',

      title: 'Tương tác với độc giả',

      description: 'Nhận bình luận, yêu thích và xây dựng cộng đồng.',
    },
  ];

  static isSupportedGenre(value: string): boolean {
    return this.GENRES.some((option) => option.value === value);
  }

  static isSupportedExperience(value: string): boolean {
    return this.EXPERIENCES.some((option) => option.value === value);
  }
}
