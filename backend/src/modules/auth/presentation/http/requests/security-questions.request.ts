import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class SecurityQuestionAnswerRequest {
  @IsUUID('4', {
    message: 'Câu hỏi bảo mật không hợp lệ',
  })
  questionId!: string;

  /*
   * Không dùng @Trim ở đây.
   *
   * Domain ValueObject sẽ normalize
   * thống nhất cho cả save/verify sau này.
   */
  @IsString()
  @Length(3, 128, {
    message: 'Câu trả lời phải có từ 3 đến 128 ký tự',
  })
  answer!: string;
}

export class UpdateSecurityQuestionsRequest {
  /*
   * Không Trim password.
   */
  @IsString()
  @Length(1, 72, {
    message: 'Mật khẩu hiện tại không hợp lệ',
  })
  currentPassword!: string;

  @IsArray()
  @ArrayMinSize(3, {
    message: 'Bạn phải thiết lập đúng 3 câu hỏi bảo mật',
  })
  @ArrayMaxSize(3, {
    message: 'Bạn phải thiết lập đúng 3 câu hỏi bảo mật',
  })
  @ValidateNested({
    each: true,
  })
  @Type(() => SecurityQuestionAnswerRequest)
  answers!: SecurityQuestionAnswerRequest[];
}

export class RemoveSecurityQuestionsRequest {
  /*
   * Không Trim password.
   */
  @IsString()
  @Length(1, 72, {
    message: 'Mật khẩu hiện tại không hợp lệ',
  })
  currentPassword!: string;
}
