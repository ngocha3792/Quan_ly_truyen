import { AuthorApplicationPolicy } from '../policies';

import { InvalidAuthorApplicationFieldException } from '../exceptions';

type OptionalField = string | null | undefined;

function normalizeOptionalText(
  value: OptionalField,

  field: string,

  maximumLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new InvalidAuthorApplicationFieldException(
      field,

      'Giá trị không hợp lệ',
    );
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (!normalized) {
    return null;
  }

  if (normalized.length > maximumLength) {
    throw new InvalidAuthorApplicationFieldException(
      field,

      `${field} vượt quá độ dài cho phép`,
    );
  }

  return normalized;
}

export class AuthorPenNameValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorPenNameValueObject {
    const value = normalizeOptionalText(
      raw,

      'penName',

      AuthorApplicationPolicy.PEN_NAME_MAX_LENGTH,
    );

    if (typeof value === 'string' && value.length < 2) {
      throw new InvalidAuthorApplicationFieldException(
        'penName',

        'Bút danh phải có ít nhất 2 ký tự',
      );
    }

    return new AuthorPenNameValueObject(value);
  }
}

export class AuthorFullNameValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorFullNameValueObject {
    return new AuthorFullNameValueObject(
      normalizeOptionalText(
        raw,

        'fullName',

        AuthorApplicationPolicy.FULL_NAME_MAX_LENGTH,
      ),
    );
  }
}

export class AuthorContactEmailValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorContactEmailValueObject {
    const value = normalizeOptionalText(
      raw,

      'email',

      320,
    );

    if (
      typeof value === 'string' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
    ) {
      throw new InvalidAuthorApplicationFieldException(
        'email',

        'Email không hợp lệ',
      );
    }

    return new AuthorContactEmailValueObject(
      typeof value === 'string' ? value.toLowerCase() : value,
    );
  }
}

export class AuthorPhoneValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorPhoneValueObject {
    const value = normalizeOptionalText(
      raw,

      'phone',

      30,
    );

    if (
      typeof value === 'string' &&
      !/^(?:\+84|0)(?:\d[\s.-]?){8,10}\d$/u.test(value)
    ) {
      throw new InvalidAuthorApplicationFieldException(
        'phone',

        'Số điện thoại không hợp lệ',
      );
    }

    return new AuthorPhoneValueObject(value);
  }
}

export class AuthorPortfolioUrlValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorPortfolioUrlValueObject {
    const value = normalizeOptionalText(
      raw,

      'portfolioUrl',

      500,
    );

    if (typeof value === 'string') {
      let url: URL;

      try {
        url = new URL(value);
      } catch {
        throw new InvalidAuthorApplicationFieldException(
          'portfolioUrl',

          'Liên kết portfolio không hợp lệ',
        );
      }

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new InvalidAuthorApplicationFieldException(
          'portfolioUrl',

          'Portfolio chỉ hỗ trợ URL HTTP hoặc HTTPS',
        );
      }
    }

    return new AuthorPortfolioUrlValueObject(value);
  }
}

export class AuthorPrimaryGenreValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorPrimaryGenreValueObject {
    const value = normalizeOptionalText(
      raw,

      'primaryGenre',

      80,
    );

    if (
      typeof value === 'string' &&
      !AuthorApplicationPolicy.isSupportedGenre(value)
    ) {
      throw new InvalidAuthorApplicationFieldException(
        'primaryGenre',

        'Thể loại chính không hợp lệ',
      );
    }

    return new AuthorPrimaryGenreValueObject(value);
  }
}

export class AuthorExperienceValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorExperienceValueObject {
    const value = normalizeOptionalText(
      raw,

      'experience',

      50,
    );

    if (
      typeof value === 'string' &&
      !AuthorApplicationPolicy.isSupportedExperience(value)
    ) {
      throw new InvalidAuthorApplicationFieldException(
        'experience',

        'Kinh nghiệm sáng tác không hợp lệ',
      );
    }

    return new AuthorExperienceValueObject(value);
  }
}

export class AuthorIntroductionValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorIntroductionValueObject {
    return new AuthorIntroductionValueObject(
      normalizeOptionalText(
        raw,

        'introduction',

        AuthorApplicationPolicy.INTRODUCTION_MAX_LENGTH,
      ),
    );
  }
}

export class AuthorSynopsisValueObject {
  private constructor(readonly value: string | null | undefined) {}

  static create(raw: OptionalField): AuthorSynopsisValueObject {
    return new AuthorSynopsisValueObject(
      normalizeOptionalText(
        raw,

        'firstWorkSynopsis',

        AuthorApplicationPolicy.SYNOPSIS_MAX_LENGTH,
      ),
    );
  }
}

export class AuthorRejectionReasonValueObject {
  private constructor(readonly value: string) {}

  static create(raw: string): AuthorRejectionReasonValueObject {
    const value = raw?.trim();

    if (
      !value ||
      value.length < 10 ||
      value.length > AuthorApplicationPolicy.REJECTION_REASON_MAX_LENGTH
    ) {
      throw new InvalidAuthorApplicationFieldException(
        'reason',

        'Lý do từ chối phải có độ dài từ 10 đến 1000 ký tự',
      );
    }

    return new AuthorRejectionReasonValueObject(value);
  }
}
