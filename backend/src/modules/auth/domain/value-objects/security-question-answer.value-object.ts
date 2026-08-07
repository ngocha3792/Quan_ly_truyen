import { InvalidInputException } from '@/common/exceptions';

export class SecurityQuestionAnswerValueObject {
  static readonly MIN_LENGTH = 3;

  static readonly MAX_LENGTH = 128;

  private constructor(readonly value: string) {}

  static create(rawValue: string): SecurityQuestionAnswerValueObject {
    if (typeof rawValue !== 'string') {
      throw invalidAnswer();
    }

    /*
     * Chuẩn hóa Unicode + khoảng trắng.
     *
     * Không lowercase giá trị dùng để verify,
     * tránh thay đổi secret của user.
     */
    const normalized = rawValue.normalize('NFKC').trim().replace(/\s+/gu, ' ');

    if (
      normalized.length < this.MIN_LENGTH ||
      normalized.length > this.MAX_LENGTH
    ) {
      throw invalidAnswer();
    }

    return new SecurityQuestionAnswerValueObject(normalized);
  }

  /*
   * Chỉ dùng để phát hiện user nhập cùng
   * một câu trả lời cho nhiều câu hỏi.
   *
   * Không dùng value này để hash/verify.
   */
  get comparisonValue(): string {
    return this.value.toLocaleLowerCase('vi');
  }
}

function invalidAnswer(): InvalidInputException {
  return new InvalidInputException({
    code: 'AUTH_SECURITY_QUESTION_ANSWER_INVALID',

    message: 'Câu trả lời bảo mật phải có từ 3 đến 128 ký tự',

    details: {
      field: 'answers',
    },
  });
}
