import { Inject, Injectable } from '@nestjs/common';
import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';
import {
  TRANSLATION_REVIEW_PORT,
  type ReviewTranslationInput,
  type TranslationReviewPort,
} from '../../ports/translation-review.port';

@Injectable()
export class ReviewTranslationCommandHandler {
  constructor(
    @Inject(TRANSLATION_REVIEW_PORT)
    private readonly persistence: TranslationReviewPort,
  ) {}
  execute(input: ReviewTranslationInput) {
    if (!isUuidV4(input.userId)) throw new AuthenticationRequiredException();
    if (input.decision !== 'APPROVE' && !input.notes?.trim())
      throw new InvalidInputException({
        message: 'Hãy ghi lý do từ chối hoặc yêu cầu sửa bản dịch.',
      });
    return this.persistence.review({ ...input, notes: input.notes?.trim() });
  }
}
